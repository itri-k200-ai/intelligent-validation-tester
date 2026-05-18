"use client";

import useSWR from "swr";
import { apiFetch } from "./api";

/**
 * Read-only client-side accessor for the app's domain/config.json.
 * Server returns it via GET /api/app/config; we cache aggressively
 * because config rarely changes mid-session and missing it just shows
 * neutral defaults.
 */

export type LangPair = { en: string; zh: string };

export type AppConfig = {
  app: {
    name: LangPair;
    slug: string;
    description: LangPair;
  };
  default_lang: "en" | "zh";
  features: {
    knowledge_tab: boolean;
    growth_timeline: boolean;
    file_upload: boolean;
    artifacts: boolean;
    personas: boolean;
  };
  hero: {
    title: LangPair;
    subtitle: LangPair;
    features: { title: LangPair; desc: LangPair }[];
    prompts: LangPair[];
  };
};

const FALLBACK: AppConfig = {
  app: {
    name: { en: "Agent App", zh: "Agent 應用" },
    slug: "agent",
    description: { en: "", zh: "" },
  },
  default_lang: "en",
  features: {
    knowledge_tab: true,
    growth_timeline: true,
    file_upload: true,
    artifacts: false,
    personas: false,
  },
  hero: {
    title: { en: "What do you want to do today?", zh: "今天想做什麼？" },
    subtitle: { en: "", zh: "" },
    features: [],
    prompts: [],
  },
};

export function useAppConfig(): AppConfig {
  const { data } = useSWR<AppConfig>(
    "/api/app/config",
    (path: string) => apiFetch<AppConfig>(path),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  return data ?? FALLBACK;
}

/** Pick the right-language string from a LangPair. */
export function pick(pair: LangPair | undefined, lang: "en" | "zh"): string {
  if (!pair) return "";
  return pair[lang] || pair.en || pair.zh || "";
}
