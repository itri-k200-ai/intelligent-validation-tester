"use client";
import { useQuery } from "@tanstack/react-query";

import type { RicSourceId } from "@/config/ricSources";
import { ricRead } from "@/services/Backend/ricBackendService";

/**
 * 某次執行的逐項判決 —— 從 RICtester back_end 讀,不需要 runningId。
 *
 * adapter 的 testStatus / testResult 要拿 runningId 才查得到,而別的團隊
 * 驅動的測試我們拿不到那個 id。改走 back_end 的資料就沒有這個限制:
 *
 *   oracle/case_results.f_suite_item_uuid
 *     → registry/suite_items.suite_item_uuid
 *          suite_item_external_id = adapter 的 testcaseId(對得回測項清單)
 *          suite_item_name        = 測項代碼(如 e2.control)
 */

const POLL_MS = 5_000;

export type RicCaseResult = {
  /** = adapter 的 testcaseId */
  testcaseId: string;
  name: string;
  /** pass / fail */
  verdict: string;
  detail: string;
  criteria: string;
  specRef: string;
};

type CaseRow = {
  result_verdict: string;
  result_detail: string;
  result_criteria_snapshot: string;
  result_spec_ref: string;
  f_suite_item_uuid: string;
};
type ItemRow = {
  suite_item_uuid: string;
  suite_item_external_id: string;
  suite_item_name: string;
};

export function useRicRunCases(runUuid: string | null, source: RicSourceId | null) {
  const query = useQuery({
    queryKey: ["ric", "run-cases", source, runUuid],
    enabled: !!runUuid && !!source,
    // 執行中會陸續寫入判決,所以要持續重抓
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<RicCaseResult[]> => {
      const src = source as RicSourceId;
      const [cases, items] = await Promise.all([
        ricRead<CaseRow>("oracle", "case_results", { f_run_uuid: runUuid }, src),
        ricRead<ItemRow>("registry", "suite_items", {}, src),
      ]);
      const byUuid = new Map(items.map((i) => [i.suite_item_uuid, i]));
      return cases.map((c) => {
        const it = byUuid.get(c.f_suite_item_uuid);
        return {
          testcaseId: it?.suite_item_external_id ?? "",
          name: it?.suite_item_name ?? "",
          verdict: c.result_verdict ?? "",
          detail: c.result_detail ?? "",
          criteria: c.result_criteria_snapshot ?? "",
          specRef: c.result_spec_ref ?? "",
        };
      });
    },
  });
  return { cases: query.data ?? [] };
}
