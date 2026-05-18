"use client";

import Link from "next/link";
import { useState } from "react";
import { relTime as relTimeI18n } from "@/lib/format";
import { useLang } from "@/lib/LangContext";
import type { Session } from "@/lib/types";
import { Empty } from "./primitives";

/**
 * Conversation history with inline-editable titles + hover delete.
 *
 * Each row is a self-contained <SessionItem>; only this tab knows about
 * the rename UX (state stays local).
 */
export default function SessionsTab({
  sessions,
  current,
  onDelete,
  onRename,
}: {
  sessions: Session[] | undefined;
  current: string;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newTitle: string) => void;
}) {
  const { t } = useLang();
  return (
    <div className="px-5 py-4 space-y-2">
      {(sessions?.length ?? 0) === 0 && (
        <Empty>{t("sessions.empty")}</Empty>
      )}
      {sessions?.map((s) => (
        <SessionItem
          key={s.id}
          session={s}
          active={s.id === current}
          onDelete={onDelete}
          onRename={onRename}
        />
      ))}
    </div>
  );
}

function SessionItem({
  session: s,
  active,
  onDelete,
  onRename,
}: {
  session: Session;
  active: boolean;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onRename: (id: string, newTitle: string) => void;
}) {
  const { lang, t } = useLang();
  const relTime = (sec: number) => relTimeI18n(sec, lang);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.title || "");

  function startEdit(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDraft(s.title || "");
    setEditing(true);
  }
  function commit() {
    const trimmed = draft.trim();
    if (trimmed) onRename(s.id, trimmed);
    setEditing(false);
  }

  const label = s.title || `${t("sessions.label.prefix")} ${s.id.slice(0, 8)}`;

  return (
    <div
      className={`group relative rounded-lg transition-colors ${
        active ? "bg-zinc-100" : "hover:bg-zinc-50"
      }`}
    >
      {editing ? (
        <div className="px-3 py-2.5">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full text-[14px] font-medium text-zinc-900 bg-white border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
          <div className="text-[12px] text-zinc-400 mt-1">
            {t("sessions.rename.hint")}
          </div>
        </div>
      ) : (
        <>
          <Link
            href={`/?s=${s.id}`}
            onDoubleClick={startEdit}
            className="block px-3 py-2.5 pr-14"
          >
            <div
              className={`text-[14px] truncate ${
                active
                  ? "font-semibold text-zinc-900"
                  : "font-medium text-zinc-800"
              }`}
            >
              {label}
            </div>
            <div className="text-[13px] text-zinc-500 mt-0.5 tabular-nums">
              {s.message_count} {t("sessions.msg")} ·{" "}
              {relTime(new Date(s.updated_at).getTime() / 1000)}
            </div>
          </Link>
          <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={startEdit}
              title={t("sessions.rename.tooltip")}
              className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-zinc-900"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </button>
            <button
              onClick={(e) => onDelete(s.id, e)}
              title={t("sessions.delete.tooltip")}
              className="w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-600"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
