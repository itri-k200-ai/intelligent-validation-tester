"use client";

import { API_BASE } from "@/lib/api";
import { fmtSize, relTime as relTimeI18n } from "@/lib/format";
import { useLang } from "@/lib/LangContext";
import type { GeneratedItem } from "@/lib/types";
import { Empty } from "./primitives";

/**
 * Lists every artifact the agent has produced. Each card has a hover-
 * delete button (the rest of the row links to the download archive).
 *
 * Display fields come from /api/generated/, which merges filesystem
 * scan with _metadata.json sidecar parsing (see
 * backend/api/files_domain/generated.py). The `xapp_type` field name is
 * historical — engine treats it as a generic "artifact type" label.
 */
export default function OutputsTab({
  items,
  onDelete,
}: {
  items: GeneratedItem[];
  onDelete: (name: string, e: React.MouseEvent) => void;
}) {
  const { lang, t } = useLang();
  const relTime = (s: number) => relTimeI18n(s, lang);
  return (
    <div className="px-5 py-4 space-y-3">
      <p className="text-[13px] text-zinc-500 leading-relaxed">
        {t("outputs.intro")}
      </p>
      {items.length === 0 && <Empty>{t("outputs.empty")}</Empty>}
      <div className="space-y-2">
        {items.map((g) => (
          <OutputCard key={g.name} g={g} relTime={relTime} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}

function OutputCard({
  g,
  relTime,
  onDelete,
}: {
  g: GeneratedItem;
  relTime: (s: number) => string;
  onDelete: (name: string, e: React.MouseEvent) => void;
}) {
  const { t } = useLang();
  const downloadUrl = g.download_url.startsWith("/api/")
    ? `${API_BASE}${g.download_url}`
    : g.download_url;
  return (
    <div className="group relative rounded-lg border border-zinc-200 bg-white px-3 py-2.5 hover:border-zinc-300 transition-colors">
      <button
        onClick={(e) => onDelete(g.name, e)}
        title={t("outputs.delete.tooltip")}
        className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center text-zinc-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      <div className="flex items-center justify-between gap-2 pr-5">
        <div className="flex items-center gap-2 min-w-0">
          {g.xapp_type && (
            <span className="text-[11px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
              {g.xapp_type}
            </span>
          )}
          <span className="text-[14px] font-medium text-zinc-900 truncate">
            {g.name}
          </span>
        </div>
        <a
          href={downloadUrl}
          className="text-[13px] text-zinc-700 hover:text-zinc-900 underline underline-offset-2 decoration-zinc-300 hover:decoration-zinc-900 shrink-0"
        >
          {t("outputs.download")}
        </a>
      </div>
      <div className="text-[13px] text-zinc-500 mt-1 tabular-nums">
        {g.file_count !== undefined
          ? `${g.file_count} ${t("outputs.files")} · ${fmtSize(g.size)}`
          : fmtSize(g.size)}{" "}
        · {g.format} · {relTime(g.mtime)}
      </div>
      {g.notes && (
        <div className="text-[13px] text-zinc-700 mt-1.5 leading-snug line-clamp-2">
          {g.notes}
        </div>
      )}
      {(g.persona || g.based_on) && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {g.persona && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700">
              persona: {g.persona}
            </span>
          )}
          {g.based_on && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-800">
              ref: {g.based_on}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
