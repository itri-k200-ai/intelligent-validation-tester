"use client";
import { useQuery } from "@tanstack/react-query";

import { ricBackend } from "@/services/Backend/ricBackendService";

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
      const [runs, projects, duts] = await Promise.all([
        ricBackend.testRuns() as Promise<RicRun[]>,
        ricBackend.projects() as Promise<
          { project_uuid: string; project_name: string; f_dut_uuid: string }[]
        >,
        ricBackend.duts() as Promise<{ dut_uuid: string; dut_name: string }[]>,
      ]);
      const projById = new Map(projects.map((p) => [p.project_uuid, p]));
      const dutById = new Map(duts.map((d) => [d.dut_uuid, d.dut_name]));

      const enriched: RicRun[] = runs.map((r) => {
        const proj = projById.get(r.f_project_uuid);
        return {
          ...r,
          scenarioName: proj?.project_name ?? "(已刪除案例)",
          dutName: (proj && dutById.get(proj.f_dut_uuid)) ?? "(未知 DUT)",
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
export function useRicRunResults(runUuid: string | null) {
  const query = useQuery({
    queryKey: ["ric", "run-results", runUuid],
    enabled: !!runUuid,
    queryFn: async () =>
      (await ricBackend.caseResults({ f_run_uuid: runUuid })) as {
        result_uuid: string;
        result_verdict: string;
        result_detail: string;
        result_spec_ref: string;
        result_criteria_snapshot: string;
      }[],
  });
  return { results: query.data ?? [], isLoading: query.isLoading };
}
