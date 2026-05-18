"use client";

import useSWR from "swr";
import AppHeader from "@/components/AppHeader";
import { apiFetch } from "@/lib/api";
import { fmtSize } from "@/lib/format";
import { useLang } from "@/lib/LangContext";
import type { Growth, GrowthEvent } from "@/lib/types";

const kindStyle: Record<
  GrowthEvent["kind"],
  { i18n: string; bar: string; chip: string; icon: string }
> = {
  memory: {
    i18n: "growth.kind.memory",
    bar: "bg-violet-400",
    chip: "bg-violet-50 text-violet-800 border-violet-100",
    icon: "🧠",
  },
  rule: {
    i18n: "growth.kind.rule",
    bar: "bg-amber-400",
    chip: "bg-amber-50 text-amber-800 border-amber-100",
    icon: "📜",
  },
  milestone: {
    i18n: "growth.kind.milestone",
    bar: "bg-emerald-400",
    chip: "bg-emerald-50 text-emerald-800 border-emerald-100",
    icon: "🚩",
  },
  generated: {
    i18n: "growth.kind.generated",
    bar: "bg-sky-400",
    chip: "bg-sky-50 text-sky-800 border-sky-100",
    icon: "📦",
  },
};

function fmtAbsolute(iso: string, lang: "en" | "zh"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return lang === "en"
    ? `${yyyy}-${mm}-${dd} ${hh}:${min}`
    : `${yyyy}/${mm}/${dd} ${hh}:${min}`;
}

function dayKey(iso: string, lang: "en" | "zh"): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return lang === "en" ? `${yyyy}-${mm}-${dd}` : `${yyyy}/${mm}/${dd}`;
}

export default function GrowthPage() {
  const { t, lang } = useLang();
  const { data, error, isLoading } = useSWR<Growth>(
    "/api/agent/growth",
    (path: string) => apiFetch<Growth>(path),
    { refreshInterval: 30_000 }
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col">
      <AppHeader backHref="/" />

      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-[26px] font-semibold tracking-tight text-zinc-900">
            {t("growth.title")}
          </h1>
          <p className="text-[14px] text-zinc-500 leading-relaxed">
            {t("growth.subtitle")}
          </p>
        </header>

        {error && (
          <div className="text-[14px] text-red-700 bg-red-50 border border-red-100 rounded-md p-3">
            {String(error)}
          </div>
        )}

        {data && (
          <>
            <StatsGrid stats={data.stats} />
            <Timeline events={data.timeline} lang={lang} />
          </>
        )}

        {!data && !error && isLoading && (
          <div className="text-[14px] text-zinc-400">{t("common.empty.placeholder")}</div>
        )}
      </main>
    </div>
  );
}

function StatsGrid({ stats }: { stats: Growth["stats"] }) {
  const { t } = useLang();
  const cells: { label: string; value: string }[] = [
    { label: t("growth.stat.memory"),    value: String(stats.memory_count) },
    { label: t("growth.stat.prompt"),    value: fmtSize(stats.prompt_size_bytes) },
    { label: t("growth.stat.subagent"),  value: String(stats.subagent_count) },
    { label: t("growth.stat.persona"),   value: String(stats.persona_count) },
    { label: t("growth.stat.types"),     value: String(stats.artifact_types_generated) },
    { label: t("growth.stat.sessions"),  value: String(stats.total_sessions) },
    { label: t("growth.stat.turns"),     value: String(stats.total_turns) },
    { label: t("growth.stat.events"),    value: String(stats.total_turn_events) },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cells.map((c) => (
        <div
          key={c.label}
          className="bg-white border border-zinc-200 rounded-lg px-4 py-3"
        >
          <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-medium">
            {c.label}
          </div>
          <div className="text-[22px] font-semibold tabular-nums text-zinc-900 mt-1">
            {c.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function Timeline({
  events,
  lang,
}: {
  events: GrowthEvent[];
  lang: "en" | "zh";
}) {
  const { t } = useLang();
  if (events.length === 0) {
    return (
      <div className="text-[14px] text-zinc-400">{t("growth.empty")}</div>
    );
  }
  // Group events by calendar day (already sorted reverse-chronological).
  const groups: { day: string; items: GrowthEvent[] }[] = [];
  for (const e of events) {
    const k = dayKey(e.ts, lang);
    const last = groups[groups.length - 1];
    if (last && last.day === k) last.items.push(e);
    else groups.push({ day: k, items: [e] });
  }

  return (
    <section className="space-y-6">
      <h2 className="text-[14px] font-semibold uppercase tracking-widest text-zinc-500">
        {t("growth.timeline")}
      </h2>
      <ol className="space-y-6">
        {groups.map((g, gi) => (
          <li key={`${gi}-${g.day}`} className="space-y-2">
            <div className="text-[12px] font-medium text-zinc-500 tabular-nums">
              {g.day}
            </div>
            <ul className="space-y-2">
              {g.items.map((e, i) => (
                <EventCard key={`${gi}-${i}-${e.ts}`} ev={e} lang={lang} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

function EventCard({ ev, lang }: { ev: GrowthEvent; lang: "en" | "zh" }) {
  const { t } = useLang();
  const style = kindStyle[ev.kind] || kindStyle.milestone;
  return (
    <li className="bg-white border border-zinc-200 rounded-lg overflow-hidden flex">
      <div className={`w-1 ${style.bar} shrink-0`} />
      <div className="flex-1 px-4 py-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] uppercase tracking-widest border rounded px-1.5 py-0.5 ${style.chip}`}>
            <span className="mr-1">{style.icon}</span>
            {t(style.i18n)}
          </span>
          <span className="text-[11px] text-zinc-400 tabular-nums">
            {fmtAbsolute(ev.ts, lang)}
          </span>
          {ev.source && (
            <code className="text-[11px] text-zinc-500 font-mono truncate max-w-[40ch]">
              {ev.source}
            </code>
          )}
        </div>
        <div className="text-[14px] font-medium text-zinc-900 mt-1.5">
          {ev.title}
        </div>
        {ev.desc && (
          <div className="text-[13px] text-zinc-600 mt-1 leading-relaxed">
            {ev.desc}
          </div>
        )}
      </div>
    </li>
  );
}
