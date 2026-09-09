"use client";
import { useQuery } from "@tanstack/react-query";

import { DEFAULT_RIC_SOURCE, RIC_SOURCES, type RicSourceId } from "@/config/ricSources";
import { ricBackend } from "@/services/Backend/ricBackendService";

export type RicCatalogEntry = {
  testcase_code: string;
  testcase_interface: string;
  testcase_procedure: string;
  testcase_spec_ref: string;
  testcase_spec_url: string;
  testcase_pass_criteria: string;
};

type CatalogMap = Map<string, RicCatalogEntry>;

const EMPTY: CatalogMap = new Map();

/**
 * RICtester 測項型錄(testcases 表):每個測項的程序名 / O-RAN 規格章節 /
 * 中文通過條件。以 testcase_code(= adapter 的 testcaseName,如 e2.setup)
 * 為 key,牆上把這些備註標在測項旁,並且是中牆時序圖的資料來源。
 *
 * 一次抓齊所有來源、各自存一份 Map(不合併 —— 不同 tester 可能有相同的
 * testcase_code,合起來會互相覆蓋)。這樣做的原因是延遲:每套 tester 第一次
 * 讀取都要先 login,而 back_end 的 login 是 bcrypt,實測單發約 0.5s。若照
 * 來源分別查詢,左螢幕一換 DUT 到另一套 tester 就要多付一次 login + 查詢,
 * 牆上會看到時序圖空一段時間。開場一次抓完就沒有這個空窗。
 */
export function useRicTestcaseCatalog(source?: RicSourceId) {
  const query = useQuery({
    queryKey: ["ric", "testcase-catalog", "all"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const settled = await Promise.allSettled(
        RIC_SOURCES.map(async (src) => {
          const rows = (await ricBackend.testcases(undefined, src.id)) as RicCatalogEntry[];
          return [src.id, new Map(rows.map((r) => [r.testcase_code, r]))] as const;
        }),
      );
      settled.forEach((r, i) => {
        if (r.status === "rejected")
          console.error(`[ric] 來源 ${RIC_SOURCES[i].id} 取測項型錄失敗:`, r.reason);
      });
      return new Map(
        settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : [])),
      ) as Map<RicSourceId, CatalogMap>;
    },
  });
  return { catalog: query.data?.get(source ?? DEFAULT_RIC_SOURCE) ?? EMPTY };
}
