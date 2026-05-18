"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import useSWR from "swr";
import { apiFetch, fetcher } from "@/lib/api";
import type { Message, Session, TurnSummary } from "@/lib/types";

/**
 * Owns the current `Session` + its `Message[]` history.
 *
 * - On URL `?s=<id>` change: fetch session + messages.
 * - Detects any in-flight Turn for the session and exposes its id so
 *   the parent can resume tailing it.
 * - Lazy-create: `ensureSession()` creates a new session on first use
 *   when none is in the URL (deferred so we don't spam empty rows).
 */
export function useSession(urlSessionId: string) {
  const router = useRouter();
  const { mutate: refetchSessionList } = useSWR<Session[]>(
    "/api/sessions/",
    fetcher
  );
  const [session, setSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inFlightTurnId, setInFlightTurnId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!urlSessionId) {
        setSession(null);
        setMessages([]);
        setInFlightTurnId(null);
        return;
      }
      try {
        const s = await apiFetch<Session>(`/api/sessions/${urlSessionId}/`);
        const msgs = await apiFetch<Message[]>(
          `/api/sessions/${urlSessionId}/messages/`
        );
        const running = await apiFetch<{ items: TurnSummary[] }>(
          `/api/turns/?session=${urlSessionId}&status=running`
        );
        if (cancelled) return;
        setSession(s);
        setMessages(msgs);
        setInFlightTurnId(running.items[0]?.id ?? null);
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [urlSessionId, router]);

  const ensureSession = useCallback(async (): Promise<Session> => {
    if (session) return session;
    const s = await apiFetch<Session>("/api/sessions/", {
      method: "POST",
      body: JSON.stringify({
        title: new Date().toISOString().slice(0, 16),
      }),
    });
    setSession(s);
    refetchSessionList();
    router.replace(`/?s=${s.id}`);
    return s;
  }, [session, refetchSessionList, router]);

  const appendMessage = useCallback((m: Message) => {
    setMessages((prev) => [...prev, m]);
  }, []);

  const clearInFlight = useCallback(() => setInFlightTurnId(null), []);

  return {
    session,
    messages,
    inFlightTurnId,
    ensureSession,
    appendMessage,
    clearInFlight,
  };
}
