"use client";
import { useQuery } from "@tanstack/react-query";

import { ricBackend } from "@/services/Backend/ricBackendService";

export type IfaceRate = { iface: string; passed: number; total: number };
export type RecentRun = {
  run_uuid: string;
  dutName: string;
  started_at: string;
  status: string;
  passed: number;
  total: number;
};
export type RicOverview = {
  counts: {
    duts: number;
    testcases: number;
    suites: number;
    runs: number;
    running: number;
  };
  overall: { passed: number; total: number };
  byIface: IfaceRate[];
  recent: RecentRun[];
};

type Row = Record<string, unknown>;
const num = (v: unknown) => {
  const x = Number(v);
  return Number.isNaN(x) ? 0 : x;
};
const str = (v: unknown) => (v == null ? "" : String(v));

/**
 * 戰情牆總覽的統計來源 —— 全部從 RICtester back_end 匯總:
 * 受測物 / 案例 / 案例集 / 執行 數量、整體與各介面(E2/A1/O1)通過率、近期執行。
 */
export function useRicOverview() {
  const query = useQuery({
    queryKey: ["ric", "overview"],
    refetchInterval: 15000,
    queryFn: async (): Promise<RicOverview> => {
      const [duts, testcases, suites, projects, runs, cases] = await Promise.all([
        ricBackend.duts({}) as Promise<Row[]>,
        ricBackend.testcases({}) as Promise<Row[]>,
        ricBackend.suites({}) as Promise<Row[]>,
        ricBackend.projects({}) as Promise<Row[]>,
        ricBackend.testRuns({}) as Promise<Row[]>,
        ricBackend.caseResults({}) as Promise<Row[]>,
      ]);

      const tcIface = new Map(
        testcases.map((t) => [str(t.testcase_uuid), str(t.testcase_interface)]),
      );
      const projDut = new Map(projects.map((p) => [str(p.project_uuid), str(p.f_dut_uuid)]));
      const dutName = new Map(duts.map((d) => [str(d.dut_uuid), str(d.dut_name)]));

      // 整體 + 各介面通過率(以 case_results 判決計)
      const ifaceAgg: Record<string, { passed: number; total: number }> = {};
      let passed = 0;
      let total = 0;
      for (const c of cases) {
        const isPass = str(c.result_verdict) === "pass";
        total += 1;
        if (isPass) passed += 1;
        const iface = tcIface.get(str(c.f_testcase_uuid))?.toUpperCase() ?? "";
        if (iface) {
          (ifaceAgg[iface] ??= { passed: 0, total: 0 }).total += 1;
          if (isPass) ifaceAgg[iface].passed += 1;
        }
      }
      const byIface = ["E2", "A1", "O1"]
        .filter((i) => ifaceAgg[i])
        .map((i) => ({ iface: i, ...ifaceAgg[i] }));

      const running = runs.filter((r) =>
        ["running", "pending"].includes(str(r.run_status)),
      ).length;

      const recent = [...runs]
        .sort((a, b) =>
          str(b.run_started_at || b.run_created_at).localeCompare(
            str(a.run_started_at || a.run_created_at),
          ),
        )
        .slice(0, 20)
        .map((r) => ({
          run_uuid: str(r.run_uuid),
          dutName: dutName.get(projDut.get(str(r.f_project_uuid)) ?? "") || "—",
          started_at: str(r.run_started_at || r.run_created_at),
          status: str(r.run_status),
          passed: num(r.run_passed),
          total: num(r.run_total),
        }));

      return {
        counts: {
          duts: duts.length,
          testcases: testcases.length,
          suites: suites.length,
          runs: runs.length,
          running,
        },
        overall: { passed, total },
        byIface,
        recent,
      };
    },
  });
  return { data: query.data, isLoading: query.isLoading };
}
