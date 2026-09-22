import { ITRI_B51_5F, ITRI_B51_5F_SLAM, type FieldBackdrop, type FloorPlan } from "@/config/floorPlans";
import type {
  FieldSample,
  FieldScenarioId,
  FieldTestcase,
  RouteWaypoint,
} from "@/types/fieldTest";

// ── 場域測試情境(中牆)────────────────────────────────────────────────
// 室外 UAV、室內 AMR 共用中牆的零件(components/FieldTest/FieldTestWall),版面各自一種:
//   - live-results(室外):左邊「即時狀態」—— 2 路影像 + 飛行狀態 / UAV 通訊品質數值;
//     右邊「測試狀態總覽」—— 路徑 | QoE xApp 啟用前後(只觀察這台 UAV)
//   - camera-grid(室內):左右各半 —— 左邊「即時狀態」2×2 影像 + 行駛狀態 / AMR 通訊品質數值;
//     右邊 路徑 | IM xApp 啟用前後
// 新增情境改這裡 + types/fieldTest.ts 的 FieldScenarioId + 假資料。

export type TrendMetric = Exclude<keyof FieldSample, "progress">;

export type TrendSpec = {
  label: string;
  unit: string;
  metric: TrendMetric;
  digits: number;
  /** rate = 吞吐量:單位依當下數值大小自動換(見 lib/formatRate) */
  kind?: "rate";
  /** false = 不標兩趟的平均差值(不是這次要改善的指標,只看趨勢);預設會標 */
  delta?: boolean;
};

type ScenarioBase = {
  /** 牆面 / 選單上的名稱 */
  title: string;
  /** 舊的 selection.href / 獨立路由 —— 直接指定要先看哪個情境(合併頁見 MERGED_PATH) */
  href: string;
  routeTitle: string;
  /**
   * 本次測試項目 —— 我們自己的標示(測項清單由左螢幕負責),不是上游量測值,
   * 所以放設定檔,mock 與實際串接共用。
   */
  testcase: FieldTestcase;
  /**
   * 規劃路徑。場域規劃的幾何,不是量測結果:上游只回位置與訊號,
   * 路線由這裡提供(室內與 floorPlan 同一個座標系)。
   */
  route: RouteWaypoint[];
  /** 路線圖底下的平面圖(向量,室內才有) */
  floorPlan?: FloorPlan;
  /**
   * 路線圖底下的底圖圖檔。有 backdrop 時,路線圖改用「世界座標」畫 ——
   * 軌跡用載具實際回報的座標,不再畫規劃路線與向量平面圖(兩者座標系不同)。
   */
  backdrop?: FieldBackdrop;
  /** 左卡「即時狀態」兩張即時數值小卡的標題 */
  live: { vehicleTitle: string; signalTitle: string };
};

export type FieldScenario = ScenarioBase &
  (
    | { layout: "live-results"; cameras: [string, string] }
    | { layout: "camera-grid"; cameras: [string, string, string, string] }
  );

// 公尺,x 向東、y 向北。
/** 室外:UAV 菱形航線 */
const UAV_ROUTE: RouteWaypoint[] = [
  { id: "H", kind: "start", x: 0, y: 0 },
  { id: "C1", kind: "checkpoint", x: 120, y: -10 },
  { id: "M1", kind: "mission", x: 165, y: -55 },
  { id: "C2", kind: "checkpoint", x: 210, y: -100 },
  { id: "M2", kind: "mission", x: 165, y: -145 },
  { id: "C3", kind: "checkpoint", x: 120, y: -190 },
  { id: "M3", kind: "mission", x: 75, y: -145 },
  { id: "C4", kind: "checkpoint", x: 30, y: -100 },
  { id: "R", kind: "return", x: 10, y: -20 },
];

/**
 * 室內:AMR 沿 51 館 5 樓走廊前進,從 505 門進 190㎡ 辦公區繞一段,再從 504 門回走廊。
 * 座標與 config/floorPlans.ts 的平面圖相同(原點在平面圖左上角),全長約 62.6 m。
 */
const AMR_ROUTE: RouteWaypoint[] = [
  { id: "S", kind: "start", x: 2.2, y: -14.8 },
  { id: "C1", kind: "checkpoint", x: 12.8, y: -14.8 },
  { id: "M1", kind: "mission", x: 24.7, y: -14.8 },
  { id: "C2", kind: "checkpoint", x: 35.3, y: -14.8 },
  { id: "M2", kind: "mission", x: 35.3, y: -7.6 },
  { id: "C3", kind: "checkpoint", x: 44.9, y: -7.6 },
  { id: "M3", kind: "mission", x: 44.9, y: -14.8 },
  { id: "R", kind: "return", x: 50.4, y: -14.8 },
];

export const FIELD_SCENARIOS: Record<FieldScenarioId, FieldScenario> = {
  outdoor: {
    title: "室外測試情境",
    href: "/outdoor-scenario",
    routeTitle: "UAV 測試路徑",
    testcase: {
      code: "uav.interference_mobility",
      name: "QoE xApp 效能測試",
      environment: "工研院52館外大草坪",
    },
    route: UAV_ROUTE,
    layout: "live-results",
    cameras: ["室外固定攝影機", "UAV 機載攝影機"],
    live: { vehicleTitle: "飛行狀態", signalTitle: "UAV 通訊品質" },
  },
  indoor: {
    title: "室內測試情境",
    href: "/indoor-scenario",
    routeTitle: "AMR 測試路徑",
    testcase: {
      code: "amr.interference_mitigation",
      name: "IM xApp 效能測試",
      environment: "工研院51館5樓",
    },
    route: AMR_ROUTE,
    floorPlan: ITRI_B51_5F,
    backdrop: ITRI_B51_5F_SLAM,
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
