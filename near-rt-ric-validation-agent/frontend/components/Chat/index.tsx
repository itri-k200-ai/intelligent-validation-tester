"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/LangContext";
import Bubble from "./Bubble";
import Composer from "./Composer";
import Hero from "./Hero";
import ThinkingBubble from "./ThinkingBubble";
import { useSession } from "./hooks/useSession";
import { useTurn } from "./hooks/useTurn";
import { useUploads } from "./hooks/useUploads";

/**
 * Main chat panel. Composes three hooks:
 *
 *   useSession  — load session by URL, expose ensureSession + appendMessage
 *   useTurn     — POST chat + tail SSE, expose streaming state + send / tailTurn
 *   useUploads  — file attach state + multipart POST
 *
 * UI sub-components (Bubble / ThinkingBubble / Composer) are stateless;
 * this file is the only place that ties everything together.
 */
export default function Chat() {
  const params = useSearchParams();
  const urlSessionId = params.get("s") || "";
  const { t } = useLang();

  const [input, setInput] = useState("");
  const [statusLine, setStatusLine] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const sessionHook = useSession(urlSessionId);
  const uploadsHook = useUploads({
    ensureSession: sessionHook.ensureSession,
    setStatusLine,
  });
  const turnHook = useTurn({
    ensureSession: sessionHook.ensureSession,
    appendMessage: sessionHook.appendMessage,
    setStatusLine,
  });

  // Resume any in-flight turn detected by useSession.
  useEffect(() => {
    if (sessionHook.inFlightTurnId && !turnHook.streaming) {
      turnHook.tailTurn(sessionHook.inFlightTurnId, 0);
      sessionHook.clearInFlight();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionHook.inFlightTurnId]);

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessionHook.messages.length, turnHook.streamedAssistant]);

  function handleSend() {
    const text = input.trim();
    const paths = uploadsHook.attachments.map((a) => a.path);
    if (!text && paths.length === 0) return;
    setInput("");
    uploadsHook.clearAttachments();
    turnHook.send(text, paths);
  }

  return (
    <main
      className={`flex-1 flex flex-col h-screen min-w-0 ${
        dragOver ? "bg-zinc-100" : "bg-white"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files?.length) {
          uploadsHook.uploadFiles(e.dataTransfer.files);
        }
      }}
    >
      <header className="px-6 py-3.5 border-b border-zinc-200 flex items-center justify-between">
        <div className="text-[13px] font-mono text-zinc-500">
          {sessionHook.session ? `#${sessionHook.session.id.slice(0, 8)}` : "—"}
        </div>
        <div className="text-[13px] text-zinc-500 flex items-center gap-3">
          {turnHook.streaming && (
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {turnHook.elapsed}s
            </span>
          )}
          <span>{statusLine}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5 bg-zinc-50">
        {sessionHook.messages.length === 0 && !turnHook.streaming && (
          <Hero onPickPrompt={(p) => setInput(p)} />
        )}
        {sessionHook.messages.map((m) => (
          <Bubble
            key={m.id}
            role={m.role}
            text={(m.content?.text as string) || ""}
            attachments={(m.content as { attachments?: string[] })?.attachments}
            createdAt={m.created_at}
            durationMs={
              typeof (m.content as { duration_ms?: number })?.duration_ms ===
              "number"
                ? (m.content as { duration_ms: number }).duration_ms
                : undefined
            }
          />
        ))}
        {turnHook.streaming && turnHook.streamedAssistant && (
          <Bubble
            role="assistant"
            text={turnHook.streamedAssistant}
            streaming
            activity={turnHook.currentActivity}
            elapsed={turnHook.elapsed}
          />
        )}
        {turnHook.streaming && !turnHook.streamedAssistant && (
          <ThinkingBubble
            activity={turnHook.currentActivity}
            elapsed={turnHook.elapsed}
            thinking={turnHook.streamedThinking}
          />
        )}
        <div ref={bottomRef} />
      </div>

      <Composer
        input={input}
        onInputChange={setInput}
        attachments={uploadsHook.attachments}
        onRemoveAttachment={uploadsHook.removeAttachment}
        onPickFiles={uploadsHook.uploadFiles}
        onSend={handleSend}
        streaming={turnHook.streaming}
        uploading={uploadsHook.uploading}
      />
    </main>
  );
}
