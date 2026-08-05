"use client";
import { useAdapterTestList } from "@/hooks/Adapter/useAdapterTestList";
import type { AdapterTestcase } from "@/services/Adapter/adapterService";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";

export type WallAdapterView = {
  /** 左選單有選到 adapter 的 DUT(dutName)時為 true → 中/右牆走 adapter 顯示 */
  active: boolean;
  dutName: string | null;
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
 * 把「左選單的 adapter 選擇(dutName/interface/testcaseId)」+ adapter testList
 * 收斂成中/右牆要顯示的資料。分工:中牆吃「當前介面」的測項(動態),
 * 右牆吃「DUT 整體」的資料(換介面不變)。
 */
export function useWallAdapterView(): WallAdapterView {
  const { duts } = useAdapterTestList();
  const sel = useWallSelectionStore((s) => s.selection);

  const dutName = sel?.dutName ?? null;
  const iface = sel?.interface ?? null;
  const active = !!dutName;

  const dut = dutName ? duts.find((d) => d.dutName === dutName) : undefined;

  // DUT 全部測項(跨案例集攤平 + 以 testcaseId 去重)
  const seen = new Set<string>();
  const allTestcases: AdapterTestcase[] = [];
  (dut?.scenarioList ?? []).forEach((s) =>
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

  const scenarios = (dut?.scenarioList ?? []).map((s) => ({
    name: s.scenarioName,
    count: s.testcaseList.length,
  }));

  const selectedTestcase =
    (sel?.testcaseId && testcases.find((tc) => tc.testcaseId === sel.testcaseId)) || null;

  return { active, dutName, interface: iface, testcases, allTestcases, scenarios, selectedTestcase };
}
