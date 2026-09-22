"use client";
import type { ReactNode } from "react";

import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import { useFieldScenarioStore } from "@/stores/fieldScenarioStore";
import type { FieldScenarioId } from "@/types/fieldTest";

/** 按鈕只放「室內 / 室外」—— 順序依規格圖(室內在前) */
const OPTIONS: { id: FieldScenarioId; label: string }[] = [
  { id: "indoor", label: "室內" },
  { id: "outdoor", label: "室外" },
];

/**
 * 室內 / 室外的 icon —— 別團隊(ISAC 那面牆)提供的 SVG,照抄以求兩邊一致,
 * 不要自己改線條。24×24 的 viewBox、線色 currentColor,跟著按鈕的字色走。
 */
const ICONS: Record<FieldScenarioId, ReactNode> = {
  // 兩棟高低不同的建築
  indoor: (
    <>
      <path d="M4.5 20V6.5h8V20" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12.5 11.5H19.5V20H12.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path
        d="M7 10h2.2M7 13.2h2.2M7 16.4h2.2M14.7 14.2h2.4M14.7 17.2h2.4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </>
  ),
  // 山 + 太陽
  outdoor: (
    <>
      <path
        d="M3.2 18.8 9.4 9.6l3.3 4.5 3.1-3.8 4.9 8.5H3.2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="17.4" cy="7.1" r="1.85" stroke="currentColor" strokeWidth="1.5" />
    </>
  ),
};

/**
 * 標題**旁**的情境切換(室內 / 室外)。版位與尺寸依前端規格圖
 * (docs/除錯截圖/影像 (4).png):icon 46×46、字 24px、對齊放在標題旁。
 *
 * 結構跟別團隊的 scene-toggle 一致:tablist 裡兩個 tab,選中的標 aria-selected。
 */
export function FieldScenarioSwitch() {
  const scenario = useFieldScenarioStore((s) => s.scenario);
  const setScenario = useFieldScenarioStore((s) => s.setScenario);

  return (
    <div
      className="field-scenario-switch"
      role="tablist"
      aria-label={OPTIONS.map((o) => o.label).join(" / ")}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          onClick={() => setScenario(o.id)}
          className={o.id === scenario ? "is-active" : undefined}
          aria-selected={o.id === scenario}
          title={FIELD_SCENARIOS[o.id].title}
        >
          <svg className="field-scenario-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            {ICONS[o.id]}
          </svg>
          {o.label}
        </button>
      ))}
    </div>
  );
}
