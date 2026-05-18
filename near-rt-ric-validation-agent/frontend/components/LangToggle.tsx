"use client";

import { useLang } from "@/lib/LangContext";

export default function LangToggle() {
  const { lang, setLang } = useLang();
  const options: { id: "en" | "zh"; label: string }[] = [
    { id: "en", label: "EN" },
    { id: "zh", label: "中" },
  ];
  return (
    <div className="inline-flex rounded-md border border-zinc-200 bg-white text-[11px] overflow-hidden">
      {options.map((o) => {
        const active = lang === o.id;
        return (
          <button
            key={o.id}
            onClick={() => setLang(o.id)}
            className={`px-1.5 py-0.5 transition-colors ${
              active
                ? "bg-zinc-900 text-white"
                : "text-zinc-600 hover:bg-zinc-50"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
