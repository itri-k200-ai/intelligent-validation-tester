"use client";
import { useQuery } from "@tanstack/react-query";

import { RIC_SOURCES, type RicSourceId } from "@/config/ricSources";
import { ricRead } from "@/services/Backend/ricBackendService";

/**
 * 偵測「現在有沒有測試正在跑」—— 不論是誰驅動的。
 *
 * 共通性測試平台(別的團隊)只會打 tester adapter 的那幾支 API,不會通知
 * IVT,所以牆這邊看不到他們的操作。但那些操作在 RICtester 的 back_end 留下
 * 完整痕跡,這裡就直接去撈:
 *
 *   scheduler/test_runs        誰在跑、跑到哪、幾項通過
 *     └ f_project_uuid → registry/projects
 *          project_external_id = adapter 的 scenarioId
 *          f_dut_uuid          → registry/duts → DUT 名稱
 *   oracle/case_results        逐項判決(顯示用,由 useRicRunCases 另外抓)
 *
 * 行為:一律回報「最近一次執行」,跑完之後也不放手 —— 牆上要停在那次的
 * 判決,直到下一次被驅動為止。中牆與左螢幕已經脫鉤,沒有「該回去顯示什麼」
 * 的目標,結束後切回總覽只會讓現場看不到剛跑完的結果。
 */

const POLL_MS = 5_000;

export type RicActiveRun = {
  source: RicSourceId;
  runUuid: string;
  dutName: string;
  /** = adapter 的 scenarioId(projects.project_external_id) */
  scenarioId: string;
  scenarioName: string;
  /**
   * 這次執行用的套件 —— 中牆要靠它拿到「本次應該跑哪幾項」的完整名單
   * (suite_items),而不是只看已經寫出判決的那幾筆。
   */
  suiteUuid: string;
  status: string;
  total: number;
  passed: number;
  failed: number;
  startedAt: string;
  finishedAt: string;
  /** 還在跑(相對於「剛跑完、還在保留顯示」) */
  live: boolean;
};

type RunRow = {
  run_uuid: string;
  run_status: string;
  run_total: string;
  run_passed: string;
  run_failed: string;
  run_started_at: string;
  run_finished_at: string;
  f_project_uuid: string;
};
type ProjRow = {
  project_uuid: string;
  project_name: string;
  project_external_id: string;
  f_dut_uuid: string;
  f_suite_uuid: string;
};
type DutRow = { dut_uuid: string; dut_name: string };

const num = (v: unknown) => Number(v) || 0;
const ms = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
};

async function activeRunOf(source: RicSourceId): Promise<RicActiveRun | null> {
  const runs = await ricRead<RunRow>("scheduler", "test_runs", {}, source);
  if (!runs.length) return null;

  // 最近一筆(以開始時間排序);跑完太久就不跟了
  const latest = [...runs].sort((a, b) => ms(b.run_started_at) - ms(a.run_started_at))[0];
  const live = latest.run_status === "running";

  const [projects, duts] = await Promise.all([
    ricRead<ProjRow>("registry", "projects", { project_uuid: latest.f_project_uuid }, source),
    ricRead<DutRow>("registry", "duts", {}, source),
  ]);
  const proj = projects[0];
  const dut = proj ? duts.find((d) => d.dut_uuid === proj.f_dut_uuid) : undefined;

  return {
    source,
    runUuid: latest.run_uuid,
    dutName: dut?.dut_name ?? "",
    scenarioId: proj?.project_external_id ?? "",
    scenarioName: proj?.project_name ?? "",
    suiteUuid: proj?.f_suite_uuid ?? "",
    status: latest.run_status,
    total: num(latest.run_total),
    passed: num(latest.run_passed),
    failed: num(latest.run_failed),
    startedAt: latest.run_started_at,
    finishedAt: latest.run_finished_at,
    live,
  };
}

/** 跨所有來源找出目前該跟的執行;都沒有就回 null。 */
export function useRicActiveRun() {
  const query = useQuery({
    queryKey: ["ric", "active-run"],
    refetchInterval: POLL_MS,
    queryFn: async (): Promise<RicActiveRun | null> => {
      const settled = await Promise.allSettled(RIC_SOURCES.map((s) => activeRunOf(s.id)));
      const found = settled
        .flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []))
        // 正在跑的優先;都沒在跑就看誰比較晚開始
        .sort((a, b) =>
          a.live === b.live ? ms(b.startedAt) - ms(a.startedAt) : a.live ? -1 : 1,
        );
      return found[0] ?? null;
    },
  });
  return { activeRun: query.data ?? null };
}
