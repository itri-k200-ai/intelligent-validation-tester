"use client";

import useSWR from "swr";
import AppHeader from "@/components/AppHeader";
import { fetcher } from "@/lib/api";
import { fmtSize, relTime as relTimeI18n } from "@/lib/format";
import { useLang } from "@/lib/LangContext";
import type { AgentInfo as Info, Knowledge } from "@/lib/types";

const kindMeta: Record<
  string,
  { en: string; zh: string; bar: string; chip: string; dot: string }
> = {
  feedback: {
    en: "Behavior correction",
    zh: "行為修正",
    bar: "bg-amber-400",
    chip: "bg-amber-50 text-amber-800 border-amber-100",
    dot: "bg-amber-400",
  },
  project: {
    en: "Project knowledge",
    zh: "專案知識",
    bar: "bg-blue-400",
    chip: "bg-blue-50 text-blue-800 border-blue-100",
    dot: "bg-blue-400",
  },
  reference: {
    en: "Operational reference",
    zh: "操作參考",
    bar: "bg-purple-400",
    chip: "bg-purple-50 text-purple-800 border-purple-100",
    dot: "bg-purple-400",
  },
  other: {
    en: "Other",
    zh: "其他",
    bar: "bg-zinc-300",
    chip: "bg-zinc-50 text-zinc-700 border-zinc-100",
    dot: "bg-zinc-300",
  },
};

export default function KnowledgePage() {
  const { lang, t } = useLang();
  const { data: knowledge } = useSWR<Knowledge>("/api/agent/knowledge", fetcher);
  const { data: info } = useSWR<Info>("/api/agent/info", fetcher);
  const relTime = (s: number) => relTimeI18n(s, lang);

  const memories = (knowledge?.memory.entries ?? [])
    .slice()
    .sort((a, b) => b.mtime - a.mtime);

  const counts: Record<string, number> = {};
  for (const m of memories) {
    const k = m.kind || "other";
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const maxCount = Math.max(1, ...Object.values(counts));

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white">
      <AppHeader
        subLabel={t("tab.knowledge")}
        backHref="/"
        backLabel={t("kn.back")}
      />

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-8 pt-16 pb-12">
        <h1 className="text-[48px] font-semibold tracking-tight text-zinc-900 leading-[1.1]">
          {t("kn.title")}
        </h1>
        <p className="text-[17px] text-zinc-600 mt-5 max-w-3xl leading-relaxed">
          {t("kn.subtitle")}
        </p>
      </section>

      {/* Stats */}
      <section className="max-w-5xl mx-auto px-8 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <BigStat
            value={memories.length}
            label={t("kn.stat.memory.long")}
            accent="bg-amber-50"
            num="text-amber-700"
          />
          <BigStat
            value={info?.session_count ?? 0}
            label={t("kn.stat.sessions.long")}
            accent="bg-blue-50"
            num="text-blue-700"
          />
          <BigStat
            value={knowledge?.subagents.length ?? 0}
            label={t("kn.stat.subagents.long")}
            accent="bg-purple-50"
            num="text-purple-700"
          />
        </div>

        {/* Distribution bars */}
        {memories.length > 0 && (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6">
            <h3 className="text-[13px] uppercase tracking-widest text-zinc-500 font-medium mb-4">
              {lang === "en"
                ? "Lessons by category"
                : "她學到的事 — 按類別分布"}
            </h3>
            <div className="space-y-3">
              {(["feedback", "project", "reference", "other"] as const).map(
                (k) => {
                  const n = counts[k] ?? 0;
                  if (n === 0) return null;
                  const meta = kindMeta[k];
                  const pct = (n / maxCount) * 100;
                  return (
                    <div key={k} className="flex items-center gap-3">
                      <div className="w-32 text-[13px] text-zinc-700">
                        {lang === "en" ? meta.en : meta.zh}
                      </div>
                      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${meta.bar} rounded-full transition-all`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="w-8 text-right text-[13px] font-medium text-zinc-700 tabular-nums">
                        {n}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        )}
      </section>

      {/* Layer 1: prompt */}
      <section className="max-w-5xl mx-auto px-8 pb-12">
        <SectionHeader
          number="01"
          title={t("kn.section.prompt")}
          hint={t("knowledge.layer1.hint")}
        />
        {knowledge?.prompt && (
          <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <span className="text-[15px] font-medium text-zinc-900 font-mono">
                prompt.md
              </span>
              <span className="text-[12px] text-zinc-500 tabular-nums">
                {fmtSize(knowledge.prompt.size)} · {relTime(knowledge.prompt.mtime)}
              </span>
            </div>
            <pre className="text-[12px] leading-relaxed p-6 bg-zinc-900 text-zinc-100 max-h-96 overflow-auto font-mono whitespace-pre-wrap">
              {knowledge.prompt.content}
            </pre>
          </div>
        )}
      </section>

      {/* Layer 2: sub-agents */}
      <section className="max-w-5xl mx-auto px-8 pb-12">
        <SectionHeader
          number="02"
          title={t("kn.section.subagents")}
          hint={t("knowledge.layer2.hint")}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {knowledge?.subagents.map((s) => (
            <div
              key={s.path}
              className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition-colors"
            >
              <div className="text-[11px] uppercase tracking-widest text-purple-600 font-medium">
                Sub-agent
              </div>
              <div className="text-[18px] font-semibold tracking-tight text-zinc-900 mt-1 font-mono">
                {s.title || s.name}
              </div>
              {s.description && (
                <p className="text-[14px] text-zinc-600 mt-3 leading-relaxed">
                  {s.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Layer 3: timeline */}
      <section className="max-w-5xl mx-auto px-8 pb-24">
        <SectionHeader
          number="03"
          title={t("kn.section.timeline")}
          hint={t("kn.section.timeline.hint")}
        />

        <div className="relative">
          {/* vertical line */}
          <div className="absolute left-2.5 top-2 bottom-2 w-px bg-zinc-200" />

          <div className="space-y-5">
            {memories.map((m) => {
              const meta = kindMeta[m.kind || "other"];
              return (
                <div key={m.path} className="relative pl-10">
                  {/* dot */}
                  <div
                    className={`absolute left-1 top-2 w-3 h-3 rounded-full ring-4 ring-white ${meta.dot}`}
                  />
                  <article className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <span
                        className={`text-[11px] uppercase tracking-widest px-2 py-0.5 rounded border ${meta.chip}`}
                      >
                        {lang === "en" ? meta.en : meta.zh}
                      </span>
                      <span className="text-[12px] text-zinc-400 tabular-nums">
                        {relTime(m.mtime)}
                      </span>
                    </div>
                    <h3 className="text-[18px] font-semibold tracking-tight text-zinc-900">
                      {m.title || m.name}
                    </h3>
                    {m.description && (
                      <p className="text-[14px] text-zinc-600 mt-2 leading-relaxed">
                        {m.description}
                      </p>
                    )}
                    {(m.why || m.how) && (
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {m.why && (
                          <div className="bg-zinc-50 rounded-lg p-4">
                            <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-medium">
                              {t("memory.field.trigger")}
                            </div>
                            <p className="text-[13px] text-zinc-700 mt-1.5 leading-relaxed">
                              {m.why}
                            </p>
                          </div>
                        )}
                        {m.how && (
                          <div className="bg-zinc-50 rounded-lg p-4">
                            <div className="text-[11px] uppercase tracking-widest text-zinc-500 font-medium">
                              {t("memory.field.apply")}
                            </div>
                            <p className="text-[13px] text-zinc-700 mt-1.5 leading-relaxed">
                              {m.how}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 py-8">
        <div className="max-w-5xl mx-auto px-8 text-[12px] text-zinc-500 flex items-center justify-between">
          <div>
            Model: <span className="font-mono">{info?.claude_version || "—"}</span>
          </div>
          <div className="tabular-nums">
            {info?.session_count ?? 0} sessions · {info?.message_count ?? 0} messages
          </div>
        </div>
      </footer>
    </div>
  );
}

function BigStat({
  value,
  label,
  accent,
  num,
}: {
  value: number;
  label: string;
  accent: string;
  num: string;
}) {
  return (
    <div className={`rounded-xl ${accent} p-6`}>
      <div className={`text-[56px] font-semibold tracking-tight leading-none tabular-nums ${num}`}>
        {value}
      </div>
      <div className="text-[13px] text-zinc-600 mt-3 leading-snug">
        {label}
      </div>
    </div>
  );
}

function SectionHeader({
  number,
  title,
  hint,
}: {
  number: string;
  title: string;
  hint: string;
}) {
  return (
    <div className="mb-6">
      <div className="text-[11px] uppercase tracking-widest text-zinc-400 font-medium">
        Layer {number}
      </div>
      <h2 className="text-[28px] font-semibold tracking-tight text-zinc-900 mt-1">
        {title}
      </h2>
      <p className="text-[14px] text-zinc-600 mt-2 leading-relaxed max-w-3xl">
        {hint}
      </p>
    </div>
  );
}
