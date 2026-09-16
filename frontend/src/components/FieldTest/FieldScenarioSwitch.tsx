"use client";
import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import { useFieldScenarioStore } from "@/stores/fieldScenarioStore";
import type { FieldScenarioId } from "@/types/fieldTest";

/** 按鈕只放「室外 / 室內」—— topbar 高度固定,標題與專案列之後放不下長標籤 */
const OPTIONS: { id: FieldScenarioId; label: string }[] = [
  { id: "outdoor", label: "室外" },
  { id: "indoor", label: "室內" },
];

/** 標題下方的情境切換(室外 / 室內);樣式見 globals.css .field-scenario-switch */
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
          {o.label}
        </button>
      ))}
    </div>
  );
}
