import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import type {
  FieldMission,
  FieldProcess,
  FieldRun,
  FieldScenarioId,
  FieldVehicleStatus,
  LinkQuality,
  RouteWaypoint,
} from "@/types/fieldTest";

import { cameraSources } from "@/lib/fieldCameras";

import { apiClient } from "../api/client";

/**
 * 場域測試(智慧網路中牆)的真實來源。
 *
 * 一律打自己的後端 /api/field-tests/*(apps/field_tests),不直打外部
 * Performance_tester —— 金鑰只在後端,而且只有後端那台連得到場域網段。
 * 欄位單位與階段名稱都在後端轉好了,這裡只補「前端才知道的東西」:
 * 路徑幾何、測試項目、攝影機位址,以及依位置算出走到第幾個路徑點。
 */

type MissionPayload = {
  runId?: string;
  /** 這一次驗測的開始時間(epoch 秒) */
  created?: number | null;
  process?: FieldProcess | null;
  status?: string;
  nextSeq?: number;
  phases?: Record<string, number>;
  currentRun: number;
  runs: FieldRun[];
  vehicle?: FieldVehicleStatus;
  link?: LinkQuality | null;
};

type LivePayload = {
  ts?: number;
  link: LinkQuality | null;
  vehicle: FieldVehicleStatus;
  position: { x: number; y: number } | null;
  /** UAV 目前的 GPS(室內為 null) */
  geo?: { lat: number; lon: number } | null;
};

/** 走到第幾個路徑點 —— 上游只回座標,路徑幾何在前端,所以這裡算 */
function reachedWaypoints(route: RouteWaypoint[], pos: { x: number; y: number } | null) {
  if (!pos || route.length === 0) return 0;
  let nearest = 0;
  let best = Infinity;
  route.forEach((wp, i) => {
    const d = (wp.x - pos.x) ** 2 + (wp.y - pos.y) ** 2;
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  return nearest + 1;
}


export const fieldTestService = {
  async mission(
    scenario: FieldScenarioId,
    opts: { sinceSeq?: number; runId?: string; signal?: AbortSignal } = {},
  ): Promise<FieldMission> {
    const { data } = await apiClient.get<MissionPayload>(`/field-tests/missions/${scenario}/`, {
      params: { since_seq: opts.sinceSeq, run_id: opts.runId },
      signal: opts.signal,
    });
    const sc = FIELD_SCENARIOS[scenario];
    const runs = data.runs.map((run, i) => ({
      ...run,
      reachedWaypoints: run.position
        ? reachedWaypoints(sc.route, run.position)
        : run.status === "finished"
          ? sc.route.length
          : run.reachedWaypoints,
      // 目前那趟的鏈路值用 /live 的即時值(後端已附在頂層)
      link: i === data.currentRun ? (data.link ?? run.link) : run.link,
    }));

    return {
      runId: data.runId,
      createdAt: data.created ?? null,
      process: data.process ?? null,
      nextSeq: data.nextSeq,
      testcase: sc.testcase,
      route: sc.route,
      currentRun: data.currentRun,
      runs,
      vehicle: data.vehicle ?? {},
      cameras: cameraSources(scenario),
    };
  },

  /** 即時數值(1~2 秒輪詢用);目前畫面吃 mission 裡的值,這支留給要更快更新的地方 */
  async live(scenario: FieldScenarioId, signal?: AbortSignal): Promise<LivePayload> {
    const { data } = await apiClient.get<LivePayload>(`/field-tests/live/${scenario}/`, { signal });
    return data;
  },
};
