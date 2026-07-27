"use client";
import { useAdapterTestList } from "@/hooks/Adapter/useAdapterTestList";
import type { AdapterTestcase } from "@/services/Adapter/adapterService";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";

export type WallAdapterView = {
  /** 左選單有選到 adapter 的 DUT(dutName)時為 true → 中/右牆走 adapter 顯示 */
  active: boolean;
  dutName: string | null;
  interface: string | null;
  /** 該 DUT + 該介面的測項(跨 scenario 攤平);沒選介面則列全部 */
  testcases: AdapterTestcase[];
  /** 該 DUT 的 scenario 名稱清單(右牆顯示)*/
  scenarioNames: string[];
  /** 中牆點選的測項(右牆顯示細節)*/
  selectedTestcase: AdapterTestcase | null;
};

/**
 * 把「左選單的 adapter 選擇(dutName/interface/testcaseId)」+ adapter testList
 * 收斂成中/右牆要顯示的資料。Phase 1:選 DUT·介面 → 中牆列測項、右牆看細節。
 */
export function useWallAdapterView(): WallAdapterView {
  const { duts } = useAdapterTestList();
  const sel = useWallSelectionStore((s) => s.selection);

  const dutName = sel?.dutName ?? null;
  const iface = sel?.interface ?? null;
  const active = !!dutName;

  const dut = dutName ? duts.find((d) => d.dutName === dutName) : undefined;
  let testcases: AdapterTestcase[] = dut
    ? dut.scenarioList.flatMap((s) => s.testcaseList)
    : [];
  if (iface) {
    const p = iface.toLowerCase();
    testcases = testcases.filter((tc) => tc.testcaseName.toLowerCase().startsWith(p + "."));
  }

  const scenarioNames = dut ? dut.scenarioList.map((s) => s.scenarioName) : [];

  const selectedTestcase =
    (sel?.testcaseId && testcases.find((tc) => tc.testcaseId === sel.testcaseId)) || null;

  return { active, dutName, interface: iface, testcases, scenarioNames, selectedTestcase };
}
