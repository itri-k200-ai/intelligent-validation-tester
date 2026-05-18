"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "@/lib/api";
import { fmtDuration, fmtTime } from "@/lib/format";
import type { Message } from "@/lib/types";
import { PaperclipIcon, Spinner } from "./icons";
import { linkifyWorkspaceFiles } from "./markdown";

/**
 * One message bubble. User bubble = solid dark, plain text. Assistant
 * bubble = white card with markdown rendering.
 *
 * When streaming, the assistant bubble grows a footer line that shows
 * the current tool call + elapsed seconds — same affordance that's
 * visible in <ThinkingBubble> while waiting for first token.
 *
 * After streaming, a per-bubble caption shows wall-clock time of the
 * message and (for assistant bubbles) the turn's total duration.
 */
export default function Bubble({
  role,
  text,
  streaming,
  attachments,
  activity,
  elapsed,
  createdAt,
  durationMs,
}: {
  role: Message["role"];
  text: string;
  streaming?: boolean;
  attachments?: string[];
  activity?: string;
  elapsed?: number;
  createdAt?: string;
  durationMs?: number;
}) {
  const isUser = role === "user";
  const rendered = linkifyWorkspaceFiles(text);
  const timeLabel = fmtTime(createdAt);
  const durLabel = !isUser ? fmtDuration(durationMs) : "";
  const showCaption = !streaming && (timeLabel || durLabel);
  return (
    <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-3xl rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
          isUser
            ? "bg-zinc-900 text-white whitespace-pre-wrap"
            : "bg-white border border-zinc-200 text-zinc-900 markdown-body"
        }`}
      >
        {attachments && attachments.length > 0 && (
          <AttachmentChips paths={attachments} isUser={isUser} />
        )}
        {isUser ? (
          <>
            {text}
            {streaming && <span className="animate-pulse">▌</span>}
          </>
        ) : (
          <>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{rendered}</ReactMarkdown>
            {streaming && <span className="animate-pulse">▌</span>}
            {streaming && (activity || (elapsed ?? 0) > 0) && (
              <div className="mt-2 pt-2 border-t border-zinc-100 text-[13px] text-zinc-500 flex items-center gap-2">
                <Spinner />
                <span className="font-mono text-zinc-600 break-all flex-1 min-w-0">
                  {activity || "…"}
                </span>
                <span className="tabular-nums text-zinc-400 shrink-0">
                  {elapsed}s
                </span>
              </div>
            )}
          </>
        )}
      </div>
      {showCaption && (
        <div className="mt-1 px-1 text-[11px] text-zinc-400 tabular-nums">
          {timeLabel}
          {timeLabel && durLabel && <span className="mx-1.5">·</span>}
          {durLabel}
        </div>
      )}
    </div>
  );
}

function AttachmentChips({
  paths,
  isUser,
}: {
  paths: string[];
  isUser: boolean;
}) {
  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
      {paths.map((p) => {
        const name = p.split("/").pop() || p;
        const url = `${API_BASE}/api/files/?path=${encodeURIComponent(p)}`;
        return (
          <a
            key={p}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ${name}`}
            className={`inline-flex items-center gap-1 text-[13px] px-2 py-0.5 rounded-md transition-colors ${
              isUser
                ? "bg-white/10 text-zinc-100 hover:bg-white/20"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
            }`}
          >
            <PaperclipIcon size={11} />
            <span className="truncate max-w-[200px]">{name}</span>
          </a>
        );
      })}
    </div>
  );
}
