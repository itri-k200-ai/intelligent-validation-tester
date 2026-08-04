"use client";
import { useQuery } from "@tanstack/react-query";

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
export function useRicTestcaseCatalog() {
  const query = useQuery({
    queryKey: ["ric", "testcase-catalog"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const rows = (await ricBackend.testcases()) as RicCatalogEntry[];
      return new Map(rows.map((r) => [r.testcase_code, r]));
    },
  });
  return { catalog: query.data ?? new Map<string, RicCatalogEntry>() };
}
