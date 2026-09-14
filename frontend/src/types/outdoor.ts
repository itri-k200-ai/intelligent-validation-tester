// ── 室外 UAV 情境(中牆)─────────────────────────────────────────────
//
// 室外 tester 尚未串接。這裡的形狀是依
// docs/外部文件/前端UI建議/2026-09-13_智慧網路實驗室_室外UAV情境中牆UI規劃.png
// 上的欄位定出來的,目前只有 mockOutdoorService 在填。之後串接時,對方欄位
// 若不同就在 service 層轉成這個形狀,畫面不用動。

/** 本次測試項目(一次只會有一個,兩趟飛行都跑同一項;測項清單由左螢幕負責) */
export type OutdoorTestcase = {
  code: string;
  procedure: string;
};

export type UavWaypointKind = "takeoff" | "checkpoint" | "mission" | "return";

/** 航點座標:公尺,以起飛點為原點,x 向東、y 向北。 */
export type UavWaypoint = { id: string; kind: UavWaypointKind; x: number; y: number };

export type UavFlightStatus = {
  /** 相對起飛點高度 */
  altitudeM: number;
  groundSpeedMps: number;
  verticalSpeedMps: number;
  batteryPct: number;
  satellites: number;
  /** 飛控模式,例如 POSCTL / MISSION / LAND */
  mode: string;
  /** 0 = 正北,順時針 */
  headingDeg: number;
  /** 距起飛點水平距離 */
  distanceM: number;
  flightTimeSec: number;
};

export type UavLinkQuality = {
  snrDb: number;
  rssiDbm: number;
  rsrqDb: number;
  sinrDb: number;
  ulMbps: number | null;
  dlMbps: number | null;
  packetLossPct: number | null;
  /** 頻段,例如 n79 */
  band: string;
  cqi: number | null;
  /** SA / NSA */
  nrMode: string;
};

/** 優化開啟前 / 開啟後 —— 無人機沿同一條航線各飛一趟,比較兩趟的結果。 */
export type OptimizationPhase = "before" | "after";

/** 沿航線取樣的一筆數據;兩趟用同一個 x(航線進度)才對得起來比較 */
export type OutdoorSample = {
  /** 航線進度 0–100 */
  progress: number;
  altitudeM: number;
  groundSpeedMps: number;
  snrDb: number;
  dlMbps: number;
};

export type OutdoorFlightRun = {
  phase: OptimizationPhase;
  status: "pending" | "running" | "finished" | "error";
  /** 這趟任務進度 0–100 */
  progress: number;
  /** 已經過的航點數(含起飛點) */
  reachedWaypoints: number;
  /** 無人機目前位置(與航點同一座標系);這趟沒在飛就是 null */
  position: { x: number; y: number } | null;
  /** 這趟的鏈路品質平均;執行中為目前累計,還沒飛是 null */
  link: UavLinkQuality | null;
  /** 沿航線的取樣(折線圖用),依 progress 遞增;執行中只到目前進度 */
  samples: OutdoorSample[];
};

export type OutdoorMission = {
  testcase: OutdoorTestcase;
  route: UavWaypoint[];
  /** 依飛行順序:[優化開啟前, 優化開啟後] */
  runs: OutdoorFlightRun[];
  /** 目前(或最後)在飛的那一趟,runs 的索引 */
  currentRun: number;
  /** 目前這趟的即時飛控 */
  flight: UavFlightStatus;
  /** HLS 串流網址;null 就顯示佔位畫面 */
  cameras: { fixed: string | null; uav: string | null };
};
