"use client";
import { useQuery } from "@tanstack/react-query";

import { DEFAULT_RIC_SOURCE, type RicSourceId } from "@/config/ricSources";
import { ricBackend, ricBackendAll } from "@/services/Backend/ricBackendService";

export type RicRun = {
  run_uuid: string;
  run_status: string;
  run_total: string;
  run_passed: string;
  run_failed: string;
  run_started_at: string;
  run_finished_at: string;
  f_project_uuid: string;
  // join 補上
  scenarioName: string;
  dutName: string;
  /** 這筆 run 來自哪一套 tester(查逐案判決時要打回同一套)。 */
  source: RicSourceId;
};

export type RicDutRuns = {
  dutName: string;
  runs: RicRun[];
};

/**
 * RICtester 測試執行歷史(scheduler/test_runs),join 出 scenario/DUT 名,
 * 按 DUT 分組、每組內依時間倒序。中牆「測試紀錄」頁用。
 */
export function useRicRunHistory() {
  const query = useQuery({
    queryKey: ["ric", "run-history"],
    refetchInterval: 10000,
    queryFn: async (): Promise<RicDutRuns[]> => {
      // 三張表都跨來源撈。UUID 只在各自的 tester 內有意義,
      // 所以 join 的 key 一律帶上 __source,避免跨套錯接。
      const [runs, projects, duts] = await Promise.all([
        ricBackendAll.testRuns() as Promise<(RicRun & { __source: RicSourceId })[]>,
        ricBackendAll.projects() as Promise<
          {
            project_uuid: string;
            project_name: string;
            f_dut_uuid: string;
            __source: RicSourceId;
          }[]
        >,
        ricBackendAll.duts() as Promise<
          { dut_uuid: string; dut_name: string; __source: RicSourceId }[]
        >,
      ]);
      const key = (src: RicSourceId, uuid: string) => `${src}:${uuid}`;
      const projById = new Map(projects.map((p) => [key(p.__source, p.project_uuid), p]));
      const dutById = new Map(duts.map((d) => [key(d.__source, d.dut_uuid), d.dut_name]));

      const enriched: RicRun[] = runs.map((r) => {
        const proj = projById.get(key(r.__source, r.f_project_uuid));
        return {
          ...r,
          source: r.__source,
          scenarioName: proj?.project_name ?? "(已刪除案例)",
          dutName: (proj && dutById.get(key(r.__source, proj.f_dut_uuid))) ?? "(未知 DUT)",
        };
      });
      // 依時間倒序
      enriched.sort((a, b) =>
        (b.run_started_at || "").localeCompare(a.run_started_at || ""),
      );
      // 按 DUT 分組(組順序依該組最新一筆 run)
      const groups = new Map<string, RicRun[]>();
      enriched.forEach((r) => {
        if (!groups.has(r.dutName)) groups.set(r.dutName, []);
        groups.get(r.dutName)!.push(r);
      });
      return [...groups.entries()].map(([dutName, rs]) => ({ dutName, runs: rs }));
    },
  });
  return { groups: query.data ?? [], isLoading: query.isLoading };
}

/** 單一 run 的逐案判決(Mongo case_results) */
export function useRicRunResults(runUuid: string | null, source?: RicSourceId) {
  const query = useQuery({
    queryKey: ["ric", "run-results", source ?? DEFAULT_RIC_SOURCE, runUuid],
    enabled: !!runUuid,
    queryFn: async () =>
      (await ricBackend.caseResults({ f_run_uuid: runUuid }, source)) as {
        result_uuid: string;
        result_verdict: string;
        result_detail: string;
        result_spec_ref: string;
        result_criteria_snapshot: string;
      }[],
  });
  return { results: query.data ?? [], isLoading: query.isLoading };
}

export type RicRunProbeLog = {
  log_uuid: string;
  probe_iface: string;
  probe_endpoint: string;
  captured_at: string;
  log_text: string;
};

// 某次 run 的探針原始 stdout(可能多介面各一筆)
export function useRicRunProbeLogs(runUuid: string | null) {
  const query = useQuery({
    queryKey: ["ric", "run-probe-logs", runUuid],
    enabled: !!runUuid,
    queryFn: async () => {
      const rows = (await ricBackend.probeLogs({ f_run_uuid: runUuid })) as RicRunProbeLog[];
      return rows.sort((a, b) => a.probe_iface.localeCompare(b.probe_iface));
    },
  });
  return { logs: query.data ?? [] };
}
