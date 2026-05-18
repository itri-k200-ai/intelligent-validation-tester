"use client";

import { useState } from "react";
import { useLang } from "@/lib/LangContext";

/**
 * Small presentational atoms shared across the Sidebar tabs.
 * Pure, no data fetching. Keep visual design tokens in one place.
 */

export function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2.5">
      <div className="text-[28px] font-semibold tracking-tight text-zinc-900 tabular-nums leading-none">
        {value}
      </div>
      <div className="text-[13px] uppercase tracking-widest text-zinc-500 mt-1.5">
        {label}
      </div>
    </div>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2.5">
      {children}
    </div>
  );
}

export function CardHeader({ name, meta }: { name: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[14px] font-medium text-zinc-900 truncate">
        {name}
      </span>
      <span className="text-[13px] text-zinc-500 tabular-nums shrink-0">
        {meta}
      </span>
    </div>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-zinc-600 mt-1 leading-relaxed line-clamp-3">
      {children}
    </p>
  );
}

export function Section({
  kicker,
  title,
  hint,
  children,
}: {
  kicker?: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div>
        {kicker && (
          <div className="text-[13px] uppercase tracking-widest text-zinc-400 font-medium">
            {kicker}
          </div>
        )}
        <h3 className="text-[14px] font-semibold tracking-tight text-zinc-900 mt-0.5">
          {title}
        </h3>
        {hint && (
          <p className="text-[13px] text-zinc-500 leading-snug mt-1">{hint}</p>
        )}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 py-1 text-[13px]">
      <span className="text-zinc-500">{k}</span>
      <span className="text-zinc-900 font-mono truncate" title={v}>
        {v}
      </span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-zinc-400 italic py-2">{children}</p>
  );
}

export function Expandable({
  label,
  content,
}: {
  label: string;
  content: string;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors inline-flex items-center gap-1"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`transition-transform ${open ? "rotate-90" : ""}`}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        {label}
      </button>
      {open && (
        <pre className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed p-3 bg-zinc-900 text-zinc-100 max-h-72 overflow-auto rounded-md font-mono">
          {content || t("common.empty.placeholder")}
        </pre>
      )}
    </div>
  );
}
