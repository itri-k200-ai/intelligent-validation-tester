import type { FieldSample, FieldScenarioId } from "@/types/fieldTest";

// ── 場域測試情境(中牆)────────────────────────────────────────────────
// 室外 UAV、室內 AMR 共用中牆的零件(components/FieldTest/FieldTestWall),版面各自一種:
//   - live-results(室外):左邊「即時狀態」—— 2 路影像 + 飛行狀態 / UAV 通訊品質數值;
//     右邊「測試狀態總覽」—— 路徑 | QoE 優化開啟前後比較(只觀察這台 UAV)
//   - camera-grid(室內):左邊 4 路影像;右邊 路徑 | UE 吞吐量 + 移動狀態 | 訊號狀態
// 新增情境改這裡 + types/fieldTest.ts 的 FieldScenarioId + 假資料。

export type TrendMetric = Exclude<keyof FieldSample, "progress">;

export type TrendSpec = { label: string; unit: string; metric: TrendMetric; digits: number };

type ScenarioBase = {
  /** 牆面 / 選單上的名稱 */
  title: string;
  /** 左螢幕送來的 selection.href,也是非牆模式的獨立路由 */
  href: string;
  routeTitle: string;
};

export type FieldScenario = ScenarioBase &
  (
    | {
        layout: "live-results";
        cameras: [string, string];
        /** 左下兩張即時小卡的標題 */
        live: { vehicleTitle: string; signalTitle: string };
      }
    | {
        layout: "camera-grid";
        cameras: [string, string, string, string];
        /** 右邊中間下半的移動狀態小卡:一張折線圖 + 標題列上的一個數值 */
        motion: { title: string; chart: TrendSpec; stat?: TrendSpec };
      }
  );

export const FIELD_SCENARIOS: Record<FieldScenarioId, FieldScenario> = {
  outdoor: {
    title: "xApp Tester 室外測試情境",
    href: "/outdoor-scenario",
    routeTitle: "UAV 測試路徑",
    layout: "live-results",
    cameras: ["室外固定攝影機", "UAV 機載攝影機"],
    live: { vehicleTitle: "飛行狀態", signalTitle: "UAV 通訊品質" },
  },
  indoor: {
    title: "xApp Tester 室內測試情境",
    href: "/indoor-scenario",
    routeTitle: "AMR 測試路徑",
    layout: "camera-grid",
    // 名稱暫定,之後依實際架設位置改
    cameras: ["廠房攝影機 1", "廠房攝影機 2", "廠房攝影機 3", "AMR 車載攝影機"],
    motion: {
      title: "行駛狀態",
      chart: { label: "行駛速度", unit: "m/s", metric: "speedMps", digits: 2 },
      stat: { label: "電量", unit: "%", metric: "batteryPct", digits: 0 },
    },
  },
};

/** selection.href(已去 query / 尾斜線)→ 情境;不是場域測試就回 null */
export function fieldScenarioByPath(path: string): FieldScenarioId | null {
  const hit = (Object.keys(FIELD_SCENARIOS) as FieldScenarioId[]).find(
    (id) => FIELD_SCENARIOS[id].href === path,
  );
  return hit ?? null;
}
