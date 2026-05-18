"use client";

import Link from "next/link";
import { fmtSize, relTime as relTimeI18n } from "@/lib/format";
import { useLang } from "@/lib/LangContext";
import type { AgentInfo, FileEntry, Knowledge } from "@/lib/types";
import {
  Card,
  CardBody,
  CardHeader,
  Empty,
  Expandable,
  KV,
  Section,
  Stat,
} from "./primitives";

/**
 * Sidebar version of the "knowledge" view: stats + the three layers
 * (system prompt / sub-agents / persistent memory). A dedicated full
 * page lives at /knowledge for the demo / investor view.
 */
export default function KnowledgePanel({
  knowledge,
  info,
}: {
  knowledge: Knowledge | undefined;
  info: AgentInfo | undefined;
}) {
  const { lang, t } = useLang();
  const relTime = (s: number) => relTimeI18n(s, lang);

  const memories = knowledge?.memory.entries ?? [];
  const byKind: Record<string, FileEntry[]> = {};
  for (const m of memories) {
    const k = m.kind || "other";
    (byKind[k] ||= []).push(m);
  }
  for (const arr of Object.values(byKind)) arr.sort((a, b) => b.mtime - a.mtime);

  const memoryGroups: { kind: string; title: string; hint: string }[] = [
    { kind: "feedback", title: t("memory.feedback.title"), hint: t("memory.feedback.hint") },
    { kind: "project", title: t("memory.project.title"), hint: t("memory.project.hint") },
    { kind: "reference", title: t("memory.reference.title"), hint: t("memory.reference.hint") },
  ];

  return (
    <div className="px-5 py-4 space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Stat value={memories.length} label={t("knowledge.stat.memory")} />
        <Stat value={info?.session_count ?? 0} label={t("knowledge.stat.sessions")} />
        <Stat value={knowledge?.subagents.length ?? 0} label={t("knowledge.stat.subagents")} />
      </div>

      <p className="text-[13px] text-zinc-500 leading-relaxed">
        {t("knowledge.intro")}
      </p>

      <Link
        href="/knowledge"
        className="inline-flex items-center justify-center w-full py-2.5 text-[13px] font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-700 transition-colors"
      >
        {t("kn.openFull")} →
      </Link>

      <Link
        href="/growth"
        className="inline-flex items-center justify-center w-full py-2.5 text-[13px] font-medium border border-zinc-300 text-zinc-700 bg-white rounded-md hover:bg-zinc-50 transition-colors"
      >
        {t("kn.openGrowth")} →
      </Link>

      <Section
        kicker={t("knowledge.layer1.kicker")}
        title={t("knowledge.layer1.title")}
        hint={t("knowledge.layer1.hint")}
      >
        {knowledge?.prompt ? (
          <Card>
            <CardHeader
              name="prompt.md"
              meta={`${fmtSize(knowledge.prompt.size)} · ${relTime(knowledge.prompt.mtime)}`}
            />
            <CardBody>{t("knowledge.layer1.body")}</CardBody>
            <Expandable label={t("knowledge.layer1.view")} content={knowledge.prompt.content} />
          </Card>
        ) : (
          <Empty>{t("knowledge.layer1.empty")}</Empty>
        )}
      </Section>

      <Section
        kicker={t("knowledge.layer2.kicker")}
        title={t("knowledge.layer2.title")}
        hint={t("knowledge.layer2.hint")}
      >
        {knowledge?.subagents?.length ? (
          knowledge.subagents.map((s) => (
            <Card key={s.path}>
              <CardHeader name={s.title || s.name} meta={relTime(s.mtime)} />
              {s.description && <CardBody>{s.description}</CardBody>}
              <Expandable label={t("knowledge.layer2.view")} content={s.content} />
            </Card>
          ))
        ) : (
          <Empty>{t("knowledge.layer2.empty")}</Empty>
        )}
      </Section>

      <Section
        kicker={t("knowledge.layer3.kicker")}
        title={t("knowledge.layer3.title")}
        hint={t("knowledge.layer3.hint")}
      >
        {memories.length === 0 && <Empty>{t("knowledge.layer3.empty")}</Empty>}
        {memoryGroups.map((g) => {
          const list = byKind[g.kind] || [];
          if (list.length === 0) return null;
          return (
            <div key={g.kind} className="space-y-2">
              <div className="flex items-baseline justify-between pt-1">
                <h4 className="text-[13px] font-medium text-zinc-800">{g.title}</h4>
                <span className="text-[13px] text-zinc-500 tabular-nums">
                  {list.length}
                </span>
              </div>
              <p className="text-[13px] text-zinc-500 leading-snug">{g.hint}</p>
              {list.map((m) => (
                <MemoryCard key={m.path} m={m} relTime={relTime} />
              ))}
            </div>
          );
        })}
        {(byKind["other"] || []).length > 0 && (
          <div className="space-y-2">
            <div className="font-medium pt-1">
              💡 其他{" "}
              <span className="text-zinc-500 font-normal">
                ({byKind["other"].length})
              </span>
            </div>
            {byKind["other"].map((m) => (
              <MemoryCard key={m.path} m={m} relTime={relTime} />
            ))}
          </div>
        )}
      </Section>

      <Section kicker={t("knowledge.runtime.kicker")} title={t("knowledge.runtime.title")}>
        <KV k={t("knowledge.runtime.model")} v={info?.claude_version || "—"} />
        <KV
          k={t("knowledge.runtime.convs")}
          v={t("knowledge.runtime.convs.fmt", {
            s: info?.session_count ?? 0,
            m: info?.message_count ?? 0,
          })}
        />
      </Section>
    </div>
  );
}

function MemoryCard({
  m,
  relTime,
}: {
  m: FileEntry;
  relTime: (s: number) => string;
}) {
  const { t } = useLang();
  return (
    <Card>
      <div className="text-[13px] text-zinc-500 tabular-nums">
        {relTime(m.mtime)}
      </div>
      <div className="text-[14px] font-medium text-zinc-900 mt-0.5">
        {m.title || m.name}
      </div>
      {m.description && <CardBody>{m.description}</CardBody>}
      {m.why && (
        <div className="mt-2 pt-2 border-t border-zinc-100">
          <div className="text-[11px] uppercase tracking-widest text-zinc-400 font-medium">
            {t("memory.field.trigger")}
          </div>
          <p className="text-[13px] text-zinc-700 mt-0.5 leading-relaxed line-clamp-4">
            {m.why}
          </p>
        </div>
      )}
      {m.how && (
        <div className="mt-2">
          <div className="text-[11px] uppercase tracking-widest text-zinc-400 font-medium">
            {t("memory.field.apply")}
          </div>
          <p className="text-[13px] text-zinc-700 mt-0.5 leading-relaxed line-clamp-4">
            {m.how}
          </p>
        </div>
      )}
      <Expandable label={t("knowledge.layer3.view")} content={m.content} />
    </Card>
  );
}
