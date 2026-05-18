"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { LANG_KEY, tr, type Lang } from "./i18n";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const LangCtx = createContext<Ctx>({
  lang: "en",
  setLang: () => {},
  t: (k) => k,
});

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = (typeof window !== "undefined" && localStorage.getItem(LANG_KEY)) as Lang | null;
    if (saved === "en" || saved === "zh") {
      setLangState(saved);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.language?.startsWith("zh")) {
      setLangState("zh");
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => tr(lang, key, vars),
    [lang]
  );

  return (
    <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>
  );
}

export function useLang() {
  return useContext(LangCtx);
}
