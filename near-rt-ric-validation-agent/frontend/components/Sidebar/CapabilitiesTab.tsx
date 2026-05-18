"use client";

import { useLang } from "@/lib/LangContext";
import { pick, useAppConfig } from "@/lib/useAppConfig";

/**
 * Top tab: what the agent can do. Renders the same per-domain feature
 * cards as the chat Hero (drawn from `domain/config.json -> hero.features`)
 * so the operator sees one consistent list whether they're starting a
 * fresh conversation or browsing capabilities.
 */
export default function CapabilitiesTab() {
  const { lang } = useLang();
  const config = useAppConfig();
  const features = config.hero.features ?? [];
  return (
    <div className="px-5 py-4 space-y-4">
      <p className="text-[13px] text-zinc-500 leading-relaxed">
        {pick(config.app.description, lang)}
      </p>
      {features.length === 0 ? (
        <p className="text-[13px] text-zinc-400">
          {lang === "zh"
            ? "尚未在 domain/config.json 設定 hero.features。"
            : "No hero.features defined in domain/config.json yet."}
        </p>
      ) : (
        features.map((f, i) => (
          <FeatureCard
            key={i}
            kicker={String(i + 1).padStart(2, "0")}
            title={pick(f.title, lang)}
            desc={pick(f.desc, lang)}
          />
        ))
      )}
    </div>
  );
}

function FeatureCard({
  kicker,
  title,
  desc,
}: {
  kicker: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3.5 hover:border-zinc-300 transition-colors">
      <div className="text-[13px] uppercase tracking-widest text-zinc-400 font-medium">
        {kicker}
      </div>
      <h3 className="text-[15px] font-semibold tracking-tight text-zinc-900 mt-0.5">
        {title}
      </h3>
      <p className="text-[13px] text-zinc-600 leading-relaxed mt-1.5">{desc}</p>
    </div>
  );
}
