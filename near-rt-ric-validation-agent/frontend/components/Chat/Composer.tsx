"use client";

import { useRef } from "react";
import { API_BASE } from "@/lib/api";
import { useLang } from "@/lib/LangContext";
import type { Attachment } from "./hooks/useUploads";
import { PaperclipIcon, XIcon } from "./icons";

/**
 * Bottom-of-page input row: attachment chips + paperclip + textarea + Send.
 * Stateless — all state lives in parent hooks. This file is purely UI.
 */
export default function Composer({
  input,
  onInputChange,
  attachments,
  onRemoveAttachment,
  onPickFiles,
  onSend,
  streaming,
  uploading,
}: {
  input: string;
  onInputChange: (s: string) => void;
  attachments: Attachment[];
  onRemoveAttachment: (idx: number) => void;
  onPickFiles: (files: FileList) => void;
  onSend: () => void;
  streaming: boolean;
  uploading: boolean;
}) {
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = !streaming && (input.trim().length > 0 || attachments.length > 0);

  return (
    <>
      {attachments.length > 0 && (
        <div className="border-t border-zinc-200 px-6 py-2.5 bg-white flex flex-wrap gap-1.5">
          {attachments.map((a, i) => (
            <AttachmentChip
              key={a.path}
              a={a}
              onRemove={() => onRemoveAttachment(i)}
            />
          ))}
        </div>
      )}
      <div className="border-t border-zinc-200 p-3 bg-white">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || streaming}
            className="h-9 w-9 flex items-center justify-center rounded-md border border-zinc-200 hover:bg-zinc-50 text-zinc-600 disabled:opacity-40 transition-colors"
            title={t("chat.attach")}
          >
            <PaperclipIcon />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onPickFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <textarea
            className="flex-1 border border-zinc-200 rounded-md px-3 py-2 text-[15px] resize-none focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-colors"
            rows={2}
            value={input}
            placeholder={t("chat.placeholder")}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            disabled={streaming}
          />
          <button
            className="h-9 px-4 text-[15px] font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
            onClick={onSend}
            disabled={!canSend}
          >
            {t("chat.send")}
          </button>
        </div>
      </div>
    </>
  );
}

function AttachmentChip({
  a,
  onRemove,
}: {
  a: Attachment;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] bg-zinc-100 rounded-md px-2 py-1 text-zinc-700">
      <a
        href={`${API_BASE}/api/files/?path=${encodeURIComponent(a.path)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="truncate max-w-[200px] font-medium hover:underline underline-offset-2 decoration-zinc-400"
        title={`Open ${a.filename}`}
      >
        {a.filename}
      </a>
      <span className="text-zinc-500 tabular-nums">
        {Math.round(a.size / 1024)}KB
      </span>
      <button
        onClick={onRemove}
        className="text-zinc-400 hover:text-zinc-900 transition-colors"
        title="Remove"
      >
        <XIcon size={10} />
      </button>
    </span>
  );
}
