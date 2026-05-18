"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, apiFetch } from "@/lib/api";
import { useLang } from "@/lib/LangContext";
import type { Message, Session } from "@/lib/types";
import { describeToolUse } from "../tools";

/**
 * Streaming turn state machine.
 *
 * `send(text, attachmentPaths)` POSTs to /chat (gets turn_id back) then
 * tails /turns/<id>/events. `tailTurn(id, since)` resumes an in-flight
 * turn without sending a new message (used when reopening a tab on a
 * still-running session).
 *
 * Disconnect-tolerant: the SSE consumer has a 30 s watchdog (2× server
 * heartbeat) that aborts the stream on silent stalls, and `tailTurn`
 * reconnects with `?since=<last_seq>` up to MAX_ATTEMPTS times. The
 * worker daemon is unaffected — events stream resumes from where it
 * stopped.
 */
export function useTurn({
  ensureSession,
  appendMessage,
  setStatusLine,
}: {
  ensureSession: () => Promise<Session>;
  appendMessage: (m: Message) => void;
  setStatusLine: (s: string) => void;
}) {
  const { t } = useLang();
  const [streaming, setStreaming] = useState(false);
  const [streamedAssistant, setStreamedAssistant] = useState("");
  const [streamedThinking, setStreamedThinking] = useState("");
  const [currentActivity, setCurrentActivity] = useState("");
  const [streamStart, setStreamStart] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  // Tick `elapsed` every 250 ms while streaming.
  useEffect(() => {
    if (!streaming) {
      setElapsed(0);
      return;
    }
    const start = streamStart || Date.now();
    const id = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      250
    );
    return () => clearInterval(id);
  }, [streaming, streamStart]);

  const tailTurn = useCallback(
    async (turnId: string, sinceInit: number) => {
      const startMs = Date.now();
      setStreaming(true);
      setStreamedAssistant("");
      setStreamedThinking("");
      setCurrentActivity("");
      setStreamStart(startMs);
      setStatusLine(t("chat.status.calling"));

      // Cross-reconnect mutable state.
      let assistantBuf = "";
      let lastSeq = sinceInit;
      let completed = false;
      let attempt = 0;

      try {
        while (!completed && attempt <= MAX_ATTEMPTS) {
          if (attempt > 0) {
            setStatusLine(t("chat.status.reconnecting", { attempt }));
            await sleep(Math.min(1000 * attempt, BACKOFF_CAP_MS));
          }
          attempt++;

          let body: ReadableStream<Uint8Array> | null = null;
          try {
            const res = await fetch(
              `${API_BASE}/api/turns/${turnId}/events?since=${lastSeq}`,
              { credentials: "same-origin" }
            );
            if (!res.ok || !res.body) {
              throw new Error(`${res.status} ${res.statusText}`);
            }
            body = res.body;
          } catch {
            continue; // network failed pre-stream; retry
          }

          try {
            const r = await consumeSSE(body, {
              setStreamedAssistant,
              setStreamedThinking,
              setCurrentActivity,
              setStatusLine,
              t,
              initialAssistantBuf: assistantBuf,
              initialLastSeq: lastSeq,
            });
            assistantBuf = r.assistantBuf;
            lastSeq = r.lastSeq;
            completed = r.completed;
          } catch {
            // Watchdog or stream error — loop retries.
          }
        }

        if (assistantBuf) {
          appendMessage({
            id: Date.now(),
            role: "assistant",
            content: { text: assistantBuf, duration_ms: Date.now() - startMs },
            created_at: new Date().toISOString(),
          });
        }
        if (!completed) {
          setStatusLine(
            t("chat.status.error.msg", { msg: "max reconnects reached" })
          );
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatusLine(t("chat.status.error.msg", { msg }));
      } finally {
        setStreaming(false);
        setStreamedAssistant("");
        setStreamedThinking("");
        setCurrentActivity("");
      }
    },
    [appendMessage, setStatusLine, t]
  );

  const send = useCallback(
    async (text: string, attachmentPaths: string[]) => {
      if (streaming) return;
      if (!text && attachmentPaths.length === 0) return;

      appendMessage({
        id: Date.now(),
        role: "user",
        content: { text, attachments: attachmentPaths },
        created_at: new Date().toISOString(),
      });

      let s: Session;
      try {
        s = await ensureSession();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatusLine(t("chat.status.error.msg", { msg }));
        return;
      }

      try {
        const start = await apiFetch<{ turn_id: string }>(
          `/api/sessions/${s.id}/chat`,
          {
            method: "POST",
            body: JSON.stringify({
              message: text,
              attachments: attachmentPaths,
            }),
          }
        );
        await tailTurn(start.turn_id, 0);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatusLine(t("chat.status.error.msg", { msg }));
      }
    },
    [streaming, ensureSession, appendMessage, setStatusLine, t, tailTurn]
  );

  return {
    streaming,
    streamedAssistant,
    streamedThinking,
    currentActivity,
    elapsed,
    send,
    tailTurn,
  };
}

// ──────────── SSE consumer (private to this hook) ────────────

// Server emits a `: keepalive` comment every 15 s. 30 s window = 2× that,
// giving us one missed heartbeat of grace before declaring the pipe dead.
const WATCHDOG_MS = 30_000;
const MAX_ATTEMPTS = 30;
const BACKOFF_CAP_MS = 3_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Setters = {
  setStreamedAssistant: (s: string) => void;
  setStreamedThinking: React.Dispatch<React.SetStateAction<string>>;
  setCurrentActivity: (s: string) => void;
  setStatusLine: (s: string) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

type ConsumeCtx = Setters & {
  initialAssistantBuf: string;
  initialLastSeq: number;
};

type ConsumeResult = {
  assistantBuf: string;
  lastSeq: number;
  completed: boolean;
};

async function consumeSSE(
  body: ReadableStream<Uint8Array>,
  c: ConsumeCtx
): Promise<ConsumeResult> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let assistantBuf = c.initialAssistantBuf;
  let lastSeq = c.initialLastSeq;
  let completed = false;

  try {
    while (!completed) {
      let value: Uint8Array | undefined;
      let done = false;
      let watchdogId: ReturnType<typeof setTimeout> | undefined;
      try {
        const result = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            watchdogId = setTimeout(
              () => reject(new Error("watchdog")),
              WATCHDOG_MS
            );
          }),
        ]);
        value = result.value;
        done = result.done;
      } finally {
        if (watchdogId !== undefined) clearTimeout(watchdogId);
      }
      if (done) break;
      buf += decoder.decode(value!, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() || "";
      for (const ev of events) {
        const r = handleSSEFrame(ev, assistantBuf, lastSeq, c);
        assistantBuf = r.assistantBuf;
        lastSeq = r.lastSeq;
        if (r.completed) completed = true;
      }
    }
  } finally {
    // Cancel the reader so the underlying connection releases promptly.
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
  }
  return { assistantBuf, lastSeq, completed };
}

type FrameResult = { assistantBuf: string; lastSeq: number; completed: boolean };

function handleSSEFrame(
  ev: string,
  assistantBuf: string,
  lastSeq: number,
  s: Setters
): FrameResult {
  const eventName =
    ev.split("\n").find((l) => l.startsWith("event: "))?.slice(7) || "msg";
  const dataStr = ev
    .split("\n")
    .filter((l) => l.startsWith("data: "))
    .map((l) => l.slice(6))
    .join("\n");
  if (!dataStr) return { assistantBuf, lastSeq, completed: false };
  let payload: {
    seq?: number;
    type?: string;
    data?: Record<string, unknown>;
    status?: string;
  };
  try {
    payload = JSON.parse(dataStr);
  } catch {
    return { assistantBuf, lastSeq, completed: false };
  }
  if (typeof payload.seq === "number" && payload.seq > lastSeq) {
    lastSeq = payload.seq;
  }
  if (eventName === "end") {
    s.setStatusLine(
      payload.status === "done"
        ? s.t("chat.status.done")
        : s.t("chat.status.error", { code: payload.status || "?" })
    );
    return { assistantBuf, lastSeq, completed: true };
  }
  if (eventName !== "msg") return { assistantBuf, lastSeq, completed: false };
  const ty = payload.type;
  const d = (payload.data || {}) as Record<
    string,
    string | number | undefined | object
  >;

  if (ty === "text_delta") {
    const next = assistantBuf + (typeof d.text === "string" ? d.text : "");
    s.setStreamedAssistant(next);
    s.setCurrentActivity("");
    return { assistantBuf: next, lastSeq, completed: false };
  }
  if (ty === "text") {
    if (!assistantBuf && typeof d.text === "string") {
      s.setStreamedAssistant(d.text);
      s.setCurrentActivity("");
      return { assistantBuf: d.text, lastSeq, completed: false };
    }
    return { assistantBuf, lastSeq, completed: false };
  }
  if (ty === "thinking_delta") {
    const chunk = typeof d.thinking === "string" ? d.thinking : "";
    if (chunk) s.setStreamedThinking((prev) => prev + chunk);
    s.setCurrentActivity("thinking…");
    return { assistantBuf, lastSeq, completed: false };
  }
  if (ty === "tool_use") {
    s.setCurrentActivity(describeToolUse(String(d.name || "tool"), d.input));
    return { assistantBuf, lastSeq, completed: false };
  }
  if (ty === "tool_result") {
    s.setCurrentActivity("");
    return { assistantBuf, lastSeq, completed: false };
  }
  if (ty === "done") {
    s.setStatusLine(
      d.exit_code === 0
        ? s.t("chat.status.done")
        : s.t("chat.status.error", { code: String(d.exit_code ?? "?") })
    );
    return { assistantBuf, lastSeq, completed: false };
  }
  if (ty === "error") {
    const msg = typeof d.message === "string" ? d.message : JSON.stringify(d);
    s.setStatusLine(s.t("chat.status.error.msg", { msg }));
    return { assistantBuf, lastSeq, completed: false };
  }
  return { assistantBuf, lastSeq, completed: false };
}
