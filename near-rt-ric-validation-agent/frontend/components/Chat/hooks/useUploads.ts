"use client";

import { useCallback, useState } from "react";
import { API_BASE } from "@/lib/api";
import { useLang } from "@/lib/LangContext";
import type { Session } from "@/lib/types";

export type Attachment = { filename: string; size: number; path: string };

/**
 * File attachment lifecycle: drag/paste → POST multipart → chips.
 *
 * Lazy-creates a session on first upload (same pattern as useTurn).
 */
export function useUploads({
  ensureSession,
  setStatusLine,
}: {
  ensureSession: () => Promise<Session>;
  setStatusLine: (s: string) => void;
}) {
  const { t } = useLang();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      setUploading(true);
      setStatusLine(t("chat.status.uploading"));
      let s: Session;
      try {
        s = await ensureSession();
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setUploading(false);
        setStatusLine(t("chat.status.upload.error", { msg }));
        return;
      }
      try {
        const fd = new FormData();
        Array.from(files).forEach((f) => fd.append("files", f));
        const res = await fetch(
          `${API_BASE}/api/sessions/${s.id}/uploads/`,
          { method: "POST", body: fd, credentials: "same-origin" }
        );
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const data = (await res.json()) as { files: Attachment[] };
        setAttachments((a) => [...a, ...data.files]);
        setStatusLine(t("chat.status.attached", { n: data.files.length }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setStatusLine(t("chat.status.upload.error", { msg }));
      } finally {
        setUploading(false);
      }
    },
    [ensureSession, setStatusLine, t]
  );

  const removeAttachment = useCallback((idx: number) => {
    setAttachments((a) => a.filter((_, i) => i !== idx));
  }, []);

  const clearAttachments = useCallback(() => setAttachments([]), []);

  return {
    attachments,
    uploading,
    uploadFiles,
    removeAttachment,
    clearAttachments,
  };
}
