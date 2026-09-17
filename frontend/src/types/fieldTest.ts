// ── 場域測試中牆(室外 UAV / 室內 AMR)──────────────────────────────────
//
// 兩個情境版面相同:載具(室外無人機、室內 AMR)沿同一條路徑跑兩趟 ——
// 啟用前、啟用後,比較兩趟的訊號與傳輸,一次只跑一個測試項目。
// 對應的 tester 尚未串接,欄位是依規劃圖
// docs/外部文件/前端UI建議/2026-09-13_智慧網路實驗室_室外UAV情境中牆UI規劃.png 定的,
// 目前只有 mockFieldTestService 在填。串接時若對方欄位不同,在 service 層轉成這個形狀,
// 畫面不用改。

export type FieldScenarioId = "outdoor" | "indoor";

/** 本次測試項目(一次只會有一個,兩趟都跑同一項;測項清單由左螢幕負責) */
export type FieldTestcase = {
  /** 測項代碼(和左螢幕 / tester 對應用,中牆不顯示) */
  code: string;
  /** 中文名稱 */
  name: string;
  /** 測試環境(短標籤,例如「工研院52館外大草坪」) */
  environment: string;
};

export type RouteWaypointKind = "start" | "checkpoint" | "mission" | "return";

/** 路徑點座標:公尺,以出發點為原點,x 向東、y 向北。 */
export type RouteWaypoint = { id: string; kind: RouteWaypointKind; x: number; y: number };

export type LinkQuality = {
  snrDb: number;
  rssiDbm: number;
  rsrqDb: number;
  sinrDb: number;
  /** 以下是 AMR 即時遙測畫面上的欄位(UAV 那邊目前沒有) */
  rsrpDbm?: number | null;
  rttMs?: number | null;
  /** 服務小區 PCI */
  pci?: number | null;
  ulMbps: number | null;
  dlMbps: number | null;
  packetLossPct: number | null;
  /** 頻段,例如 n79 */
  band: string;
  cqi: number | null;
  /** SA / NSA */
  nrMode: string;
};

/** 啟用前 / 啟用後 —— 載具沿同一條路徑各跑一趟,比較兩趟的結果。 */
export type OptimizationPhase = "before" | "after";

/** 沿路徑取樣的一筆數據;兩趟用同一個 x(路徑進度)才對得起來比較 */
export type FieldSample = {
  /** 路徑進度 0–100 */
  progress: number;
  /** 移動速度(UAV 為地速) */
  speedMps: number;
  /** 相對高度 —— 只有 UAV 有 */
  altitudeM?: number;
  batteryPct: number;
  snrDb: number;
  dlMbps: number;
  ulMbps: number;
};

export type FieldRun = {
  phase: OptimizationPhase;
  status: "pending" | "running" | "finished" | "error";
  /** 這趟測試進度 0–100 */
  progress: number;
  /** 已經過的路徑點數(含出發點) */
  reachedWaypoints: number;
  /** 載具目前位置(與路徑點同一座標系);這趟沒在跑就是 null */
  position: { x: number; y: number } | null;
  /** 這趟的鏈路品質平均;執行中為目前累計,還沒跑是 null */
  link: LinkQuality | null;
  /** 沿路徑的取樣(折線圖用),依 progress 遞增;執行中只到目前進度 */
  samples: FieldSample[];
};

/** 載具目前的即時狀態(左側即時數值、路徑圖箭頭用) */
export type FieldVehicleStatus = {
  /** 0 = 正北,順時針 */
  headingDeg: number;
  speedMps: number;
  batteryPct: number;
  /** 控制模式,例如 MISSION / AUTO */
  mode: string;
  /** 以下只有 UAV 有 */
  altitudeM?: number;
  verticalSpeedMps?: number;
  satellites?: number;
  /** 只有 AMR 有:SLAM 定位品質(即時遙測畫面上的「定位品質」) */
  localizationPct?: number;
};

export type FieldMission = {
  testcase: FieldTestcase;
  route: RouteWaypoint[];
  /** 依執行順序:[啟用前, 啟用後] */
  runs: FieldRun[];
  /** 目前(或最後)在跑的那一趟,runs 的索引 */
  currentRun: number;
  vehicle: FieldVehicleStatus;
  /** HLS 串流網址,順序對應 config/fieldScenarios.ts 的 cameras;null 就顯示佔位畫面 */
  cameras: (string | null)[];
};
