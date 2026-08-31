"use client";
import type { RicSourceId } from "@/config/ricSources";
import { useAdapterTestList } from "@/hooks/Adapter/useAdapterTestList";
import { useRicActiveRun } from "@/hooks/Backend/useRicActiveRun";
import type { AdapterTestcase } from "@/services/Adapter/adapterService";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";

export type WallAdapterView = {
  /** 左選單有選到 adapter 的 DUT(dutName)時為 true → 中/右牆走 adapter 顯示 */
  active: boolean;
  dutName: string | null;
  /** 選中的 DUT 屬於哪一套 tester。 */
  source: RicSourceId | null;
  /** 選中的案例;null 代表看整台 DUT。 */
  scenarioId: string | null;
  /** 目前正在跟的執行(自動跟隨時才有);null 表示顯示的是手動選擇。 */
  followingRun: ReturnType<typeof useRicActiveRun>["activeRun"];
  interface: string | null;
  /** 該 DUT + 該介面的測項(跨 scenario 攤平);沒選介面則列全部。中牆用。 */
  testcases: AdapterTestcase[];
  /** 該 DUT 的全部測項(不分介面,去重)。右牆 DUT 層級統計用。 */
  allTestcases: AdapterTestcase[];
  /** 該 DUT 的案例集摘要(名稱 + 測項數)。右牆顯示。 */
  scenarios: { name: string; count: number }[];
  /** 中牆點選的測項 */
  selectedTestcase: AdapterTestcase | null;
};

/**
 * 把「左螢幕的選擇(dutName / scenarioId / interface / testcaseId)」+ adapter
 * testList 收斂成中牆要顯示的資料。選了案例就只顯示該案例的測項。分工:中牆吃「當前介面」的測項(動態),
 * 右牆吃「DUT 整體」的資料(換介面不變)。
 */
export function useWallAdapterView(): WallAdapterView {
  const { duts } = useAdapterTestList();
  const sel = useWallSelectionStore((s) => s.selection);
  // 有測試在跑(不論誰驅動的)就自動跟過去 —— 別的團隊從他們那邊操作時,
  // 牆上會跟著切換。跑完保留一小段時間再放手,回到左螢幕手動選的目標。
  const { activeRun } = useRicActiveRun();

  const dutName = activeRun?.dutName || sel?.dutName || null;
  const source = activeRun?.source ?? sel?.source ?? null;
  const iface = activeRun ? null : (sel?.interface ?? null);
  const scenarioId = activeRun?.scenarioId || sel?.scenarioId || null;
  const active = !!dutName;

  // 不同 tester 可能有同名 DUT,一定要連 source 一起比對。
  const dut = dutName
    ? duts.find((d) => d.dutName === dutName && (!source || d.source === source))
    : undefined;

  // 選了案例就只看那個案例;沒選則整台 DUT 的案例都算。
  const scopedScenarios = scenarioId
    ? (dut?.scenarioList ?? []).filter((s) => s.scenarioId === scenarioId)
    : (dut?.scenarioList ?? []);

  // 測項(跨案例集攤平 + 以 testcaseId 去重)
  const seen = new Set<string>();
  const allTestcases: AdapterTestcase[] = [];
  scopedScenarios.forEach((s) =>
    s.testcaseList.forEach((tc) => {
      if (!seen.has(tc.testcaseId)) {
        seen.add(tc.testcaseId);
        allTestcases.push(tc);
      }
    }),
  );

  // 中牆用:依選中介面過濾
  const testcases = iface
    ? allTestcases.filter((tc) =>
        tc.testcaseName.toLowerCase().startsWith(iface.toLowerCase() + "."),
      )
    : allTestcases;

  const scenarios = scopedScenarios.map((s) => ({
    name: s.scenarioName,
    count: s.testcaseList.length,
  }));

  const selectedTestcase =
    (sel?.testcaseId && testcases.find((tc) => tc.testcaseId === sel.testcaseId)) || null;

  return {
    active,
    dutName,
    source: dut?.source ?? source,
    scenarioId,
    followingRun: activeRun,
    interface: iface,
    testcases,
    allTestcases,
    scenarios,
    selectedTestcase,
  };
}
