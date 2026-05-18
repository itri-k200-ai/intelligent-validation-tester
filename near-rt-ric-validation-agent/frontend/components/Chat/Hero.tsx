"use client";

import { useLang } from "@/lib/LangContext";
import { pick, useAppConfig } from "@/lib/useAppConfig";

/**
 * Empty-state welcome panel. Renders title + feature cards + starter
 * prompts entirely from domain/config.json — no app-specific copy in
 * this file. `onPickPrompt(text)` fills the composer; the user still
 * has to press Send so they can edit first.
 */
export default function Hero({ onPickPrompt }: { onPickPrompt: (p: string) => void }) {
  const { lang } = useLang();
  const config = useAppConfig();
  const heroFeatures = config.hero.features ?? [];
  const heroPrompts = config.hero.prompts ?? [];

  return (
    <div className="max-w-3xl mx-auto pt-10 pb-4 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-[28px] font-semibold tracking-tight text-zinc-900">
          {pick(config.hero.title, lang)}
        </h2>
        {pick(config.hero.subtitle, lang) && (
          <p className="text-[15px] text-zinc-500 leading-relaxed">
            {pick(config.hero.subtitle, lang)}
          </p>
        )}
      </div>

      {heroFeatures.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {heroFeatures.map((f, i) => (
            <div
              key={i}
              className="border border-zinc-200 bg-white rounded-lg p-3.5"
            >
              <div className="text-[14px] font-semibold text-zinc-900">
                {pick(f.title, lang)}
              </div>
              <div className="text-[13px] text-zinc-500 mt-1 leading-relaxed">
                {pick(f.desc, lang)}
              </div>
            </div>
          ))}
        </div>
      )}

      {heroPrompts.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] uppercase tracking-widest text-zinc-400 font-medium">
            {lang === "zh" ? "試試這些" : "Try one of these"}
          </div>
          <div className="flex flex-col gap-1.5">
            {heroPrompts.map((p, i) => {
              const text = pick(p, lang);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onPickPrompt(text)}
                  className="text-left text-[14px] text-zinc-700 border border-zinc-200 bg-white rounded-md px-3 py-2 hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
