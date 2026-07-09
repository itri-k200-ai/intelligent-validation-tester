"use client";
import { useQuery } from "@tanstack/react-query";

import { scenarioService } from "@/services";
import type { TestCase } from "@/types/scenario";

/**
 * 某 DUT 類型「連接介面驗證」適用的測試案例清單。
 * 先找該類型的 interface-validation scenario,再拉它底下的 test-cases。
 * P1:中牆「即時測試結果」帶 idle 時顯示這份清單。
 */
export function useDutTestCases(dutType: string | null) {
  const query = useQuery({
    queryKey: ["dut-test-cases", dutType],
    enabled: !!dutType,
    queryFn: async (): Promise<TestCase[]> => {
      const scenario = await scenarioService.findInterfaceScenario(dutType as string);
      if (!scenario) return [];
      return scenarioService.listCases(scenario.id);
    },
  });
  return {
    cases: query.data ?? [],
    isLoading: query.isLoading,
  };
}
