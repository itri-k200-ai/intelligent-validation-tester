import { ITRI_B51_5F, type FloorPlan } from "@/config/floorPlans";
import type { FieldSample, FieldScenarioId } from "@/types/fieldTest";

// ── 場域測試情境(中牆)────────────────────────────────────────────────
// 室外 UAV、室內 AMR 共用中牆的零件(components/FieldTest/FieldTestWall),版面各自一種:
//   - live-results(室外):左邊「即時狀態」—— 2 路影像 + 飛行狀態 / UAV 通訊品質數值;
//     右邊「測試狀態總覽」—— 路徑 | QoE xApp 啟用前後(只觀察這台 UAV)
//   - camera-grid(室內):左右各半 —— 左邊「即時狀態」2×2 影像 + 行駛狀態 / AMR 通訊品質數值;
//     右邊 路徑 | IM xApp 啟用前後
// 新增情境改這裡 + types/fieldTest.ts 的 FieldScenarioId + 假資料。

export type TrendMetric = Exclude<keyof FieldSample, "progress">;

export type TrendSpec = { label: string; unit: string; metric: TrendMetric; digits: number };

type ScenarioBase = {
  /** 牆面 / 選單上的名稱 */
  title: string;
  /** 舊的 selection.href / 獨立路由 —— 直接指定要先看哪個情境(合併頁見 MERGED_PATH) */
  href: string;
  routeTitle: string;
  /** 路線圖底下的平面圖(室內才有) */
  floorPlan?: FloorPlan;
  /** 左卡「即時狀態」兩張即時數值小卡的標題 */
  live: { vehicleTitle: string; signalTitle: string };
};

export type FieldScenario = ScenarioBase &
  (
    | { layout: "live-results"; cameras: [string, string] }
    | { layout: "camera-grid"; cameras: [string, string, string, string] }
  );

export const FIELD_SCENARIOS: Record<FieldScenarioId, FieldScenario> = {
  outdoor: {
    title: "室外測試情境",
    href: "/outdoor-scenario",
    routeTitle: "UAV 測試路徑",
    layout: "live-results",
    cameras: ["室外固定攝影機", "UAV 機載攝影機"],
    live: { vehicleTitle: "飛行狀態", signalTitle: "UAV 通訊品質" },
  },
  indoor: {
    title: "室內測試情境",
    href: "/indoor-scenario",
    routeTitle: "AMR 測試路徑",
    floorPlan: ITRI_B51_5F,
    layout: "camera-grid",
    cameras: ["室內固定攝影機 1", "室內固定攝影機 2", "室內固定攝影機 3", "AMR 車載攝影機"],
    live: { vehicleTitle: "行駛狀態", signalTitle: "AMR 通訊品質" },
  },
};

/** 室外 / 室內合併後的路由:牆上用標題下方的按鈕切換情境 */
export const FIELD_SCENARIO_MERGED_PATH = "/smart-network";

/**
 * selection.href(已去 query / 尾斜線)→ 一開始要顯示哪個情境;不是場域測試就回 null。
 * 合併頁預設室外;舊的 /outdoor-scenario、/indoor-scenario 仍可用,直接指定情境。
 */
export function fieldScenarioByPath(path: string): FieldScenarioId | null {
  if (path === FIELD_SCENARIO_MERGED_PATH) return "outdoor";
  const hit = (Object.keys(FIELD_SCENARIOS) as FieldScenarioId[]).find(
    (id) => FIELD_SCENARIOS[id].href === path,
  );
  return hit ?? null;
}
