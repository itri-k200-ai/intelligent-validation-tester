"use client";
import { useQuery } from "@tanstack/react-query";

import { DEFAULT_RIC_SOURCE, type RicSourceId } from "@/config/ricSources";
import { ricBackend } from "@/services/Backend/ricBackendService";

export type RicCatalogEntry = {
  testcase_code: string;
  testcase_interface: string;
  testcase_procedure: string;
  testcase_spec_ref: string;
  testcase_spec_url: string;
  testcase_pass_criteria: string;
};

/**
 * RICtester 測項型錄(testcases 表):每個測項的程序名 / O-RAN 規格章節 /
 * 中文通過條件。以 testcase_code(= adapter 的 testcaseName,如 e2.setup)
 * 為 key,牆上把這些備註標在測項旁,幫助看懂每項在測什麼。
 */
export function useRicTestcaseCatalog(source?: RicSourceId) {
  const query = useQuery({
    // 型錄按來源分開查:不同 tester 可能有相同的 testcase_code(如 a1.*),
    // 合併成一個 Map 會互相覆蓋,所以只取當前 DUT 那一套。
    queryKey: ["ric", "testcase-catalog", source ?? DEFAULT_RIC_SOURCE],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = (await ricBackend.testcases(undefined, source)) as RicCatalogEntry[];
      return new Map(rows.map((r) => [r.testcase_code, r]));
    },
  });
  return { catalog: query.data ?? new Map<string, RicCatalogEntry>() };
}
