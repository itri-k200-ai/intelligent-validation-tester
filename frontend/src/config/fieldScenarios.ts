import type { FieldSample, FieldScenarioId } from "@/types/fieldTest";

// ── 場域測試情境(中牆)────────────────────────────────────────────────
// 室外 UAV、室內 AMR 共用同一套中牆畫面(components/FieldTest/FieldTestWall),
// 差別在攝影機數量、載具相關的名稱,以及場域 UE 吞吐量圖放哪:
//   - throughputOnRight = false:左邊 2 路影像 + UE 吞吐量,右邊中間整欄是移動狀態(兩張折線圖)
//   - throughputOnRight = true:左邊 4 路影像(2×2),右邊中間上半 UE 吞吐量、下半移動狀態(一張折線圖)
// 新增情境改這裡 + types/fieldTest.ts 的 FieldScenarioId + 假資料。

export type TrendMetric = Exclude<keyof FieldSample, "progress">;

export type TrendSpec = { label: string; unit: string; metric: TrendMetric; digits: number };

export type FieldScenario = {
  /** 牆面 / 選單上的名稱 */
  title: string;
  /** 左螢幕送來的 selection.href,也是非牆模式的獨立路由 */
  href: string;
  /** 攝影機名稱;2 路並排、4 路排成 2×2(目前版面只支援這兩種) */
  cameras: [string, string] | [string, string, string, string];
  routeTitle: string;
  /** 場域 UE 吞吐量圖放右邊中間(左邊就只放影像) */
  throughputOnRight: boolean;
  /**
   * 移動狀態小卡。整欄時畫兩張折線圖;與 UE 吞吐量共用一欄時只畫第一張,
   * stat 以數值顯示在標題列(不畫圖)。
   */
  motion: { title: string; charts: [TrendSpec] | [TrendSpec, TrendSpec]; stat?: TrendSpec };
};

export const FIELD_SCENARIOS: Record<FieldScenarioId, FieldScenario> = {
  outdoor: {
    title: "室外 UAV 情境",
    href: "/outdoor-scenario",
    cameras: ["室外固定攝影機", "無人機機載攝影機"],
    routeTitle: "UAV 測試路徑",
    throughputOnRight: false,
    motion: {
      title: "飛行狀態",
      charts: [
        { label: "相對高度", unit: "m", metric: "altitudeM", digits: 1 },
        { label: "地速", unit: "m/s", metric: "speedMps", digits: 1 },
      ],
    },
  },
  indoor: {
    title: "室內 AMR 情境",
    href: "/indoor-scenario",
    // 名稱暫定,之後依實際架設位置改
    cameras: ["廠房攝影機 1", "廠房攝影機 2", "廠房攝影機 3", "AMR 車載攝影機"],
    routeTitle: "AMR 測試路徑",
    throughputOnRight: true,
    motion: {
      title: "行駛狀態",
      charts: [{ label: "行駛速度", unit: "m/s", metric: "speedMps", digits: 2 }],
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
