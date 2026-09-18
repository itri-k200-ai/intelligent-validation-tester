"use client";
import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import { useFieldScenarioStore } from "@/stores/fieldScenarioStore";
import type { FieldScenarioId } from "@/types/fieldTest";

/** 按鈕只放「室內 / 室外」—— 順序依規格圖(室內在前) */
const OPTIONS: { id: FieldScenarioId; label: string }[] = [
  { id: "indoor", label: "室內" },
  { id: "outdoor", label: "室外" },
];

/**
 * 標題**旁**的情境切換(室內 / 室外)。版位與尺寸依前端規格圖
 * (docs/除錯截圖/影像 (4).png):icon 46×46、字 24px、對齊放在標題旁。
 *
 * icon 尚未提供 —— 先用 .field-scenario-icon 佔位(固定 46×46 的空盒),
 * 之後把圖塞進那個 span 即可,不用再動版面。
 */
export function FieldScenarioSwitch() {
  const scenario = useFieldScenarioStore((s) => s.scenario);
  const setScenario = useFieldScenarioStore((s) => s.setScenario);

  return (
    <div className="field-scenario-switch" role="group" aria-label="切換測試情境">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => setScenario(o.id)}
          className={o.id === scenario ? "is-active" : undefined}
          aria-pressed={o.id === scenario}
          title={FIELD_SCENARIOS[o.id].title}
        >
          {/* icon 之後補:圖放進這個 span,尺寸已經固定成規格的 46×46 */}
          <span className="field-scenario-icon" aria-hidden="true" />
          {o.label}
        </button>
      ))}
    </div>
  );
}
