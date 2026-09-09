"use client";
import { useQuery } from "@tanstack/react-query";

import type { RicSourceId } from "@/config/ricSources";
import { ricRead } from "@/services/Backend/ricBackendService";

/**
 * 某次執行的「完整測項名單 + 逐項判決」—— 從 RICtester back_end 讀,
 * 不需要 runningId。
 *
 * adapter 的 testStatus / testResult 要拿 runningId 才查得到,而別的團隊
 * 驅動的測試我們拿不到那個 id。改走 back_end 的資料就沒有這個限制:
 *
 *   test_runs.f_project_uuid
 *     → registry/projects.f_suite_uuid                  ← 本次跑的是哪個套件
 *          → registry/suite_items(f_suite_uuid 過濾)   ← 本次的完整名單
 *               suite_item_order       = 執行順序
 *               suite_item_name        = 測項代碼(如 o1.get_alarms)
 *               suite_item_external_id = adapter 的 testcaseId
 *     → oracle/case_results(f_run_uuid 過濾)           ← 已經跑完的判決
 *          f_suite_item_uuid 對回上面那份名單
 *
 * ⚠ 名單一定要以 suite_items 為準,不能只列 case_results ——
 *   判決是「跑完一項寫一筆」,執行途中只讀 case_results 會讓牆上顯示
 *   「共 3 項」然後慢慢長到 4 項,總數看起來是錯的(而且進度條會一直
 *   停在 100%)。以套件名單打底、判決往上疊,總數從頭到尾都是對的。
 */

const POLL_MS = 5_000;

export type RicCaseResult = {
  /** = adapter 的 testcaseId */
  testcaseId: string;
  /** 測項代碼(如 o1.get_alarms)—— 中牆拿它查型錄畫時序圖 */
  name: string;
  /** pass / fail;還沒跑到的是空字串 */
  verdict: string;
  detail: string;
  criteria: string;
  specRef: string;
  /** 套件內的執行順序 */
  order: number;
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
  suite_item_order: string;
  suite_item_external_id: string;
  suite_item_name: string;
  f_suite_uuid: string;
};

export function useRicRunCases(
  runUuid: string | null,
  source: RicSourceId | null,
  suiteUuid: string | null,
) {
  const query = useQuery({
    queryKey: ["ric", "run-cases", source, runUuid, suiteUuid],
    enabled: !!runUuid && !!source,
    // 執行中會陸續寫入判決,所以要持續重抓
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<RicCaseResult[]> => {
      const src = source as RicSourceId;
      const [cases, items] = await Promise.all([
        ricRead<CaseRow>("oracle", "case_results", { f_run_uuid: runUuid }, src),
        ricRead<ItemRow>("registry", "suite_items", {}, src),
      ]);

      const resultByItem = new Map(cases.map((c) => [c.f_suite_item_uuid, c]));
      // 這次執行的套件名單(照 order 排);拿不到 suiteUuid 時退回「只列有
      // 判決的」,至少不會整個空掉。
      const roster = suiteUuid
        ? items.filter((i) => i.f_suite_uuid === suiteUuid)
        : items.filter((i) => resultByItem.has(i.suite_item_uuid));

      return roster
        .sort((a, b) => Number(a.suite_item_order) - Number(b.suite_item_order))
        .map((it) => {
          const c = resultByItem.get(it.suite_item_uuid);
          return {
            testcaseId: it.suite_item_external_id ?? "",
            name: it.suite_item_name ?? "",
            verdict: c?.result_verdict ?? "",
            detail: c?.result_detail ?? "",
            criteria: c?.result_criteria_snapshot ?? "",
            specRef: c?.result_spec_ref ?? "",
            order: Number(it.suite_item_order) || 0,
          };
        });
    },
  });
  return { cases: query.data ?? [] };
}
