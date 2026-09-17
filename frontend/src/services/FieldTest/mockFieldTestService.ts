import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import type {
  FieldMission,
  FieldRun,
  FieldSample,
  FieldScenarioId,
  LinkQuality,
  OptimizationPhase,
} from "@/types/fieldTest";

/**
 * 場域測試的假資料(固定值)。
 *
 * 給沒有外部平台時看版面用(NEXT_PUBLIC_USE_MOCK=true):載具沿同一條路徑跑兩趟,
 * 第一趟「啟用前」已跑完、第二趟「啟用後」跑到一半。欄位與實際串接後一致
 * (見 services/FieldTest/fieldTestService.ts),所以畫面不會因為換來源而改。
 *
 * 路徑與測試項目都取自 config/fieldScenarios,不在這裡另外定義。
 */

/**
 * 假資料用:室外航線上受干擾、訊號會下滑的兩段(路徑進度 %)。
 * 只用來產生折線的起伏,畫面上不標示 —— 實際干擾範圍會隨環境變動,不是固定的區域。
 */
const OUTDOOR_ZONES: { from: number; to: number }[] = [
  { from: 28, to: 46 },
  { from: 58, to: 76 },
];

/** 干擾程度 0~1:進出干擾區的邊界各有約 4% 的漸變 */
function interference(p: number) {
  return Math.max(
    0,
    ...OUTDOOR_ZONES.map((z) => Math.min(Math.max(Math.min(p - z.from, z.to - p) / 4 + 0.5, 0), 1)),
  );
}

/**
 * 沿路徑每 4% 取一筆。路徑中段離基地台最遠,訊號最差;啟用後 SINR、下行吞吐量整體較高。
 * 用固定公式算出來,每次都一樣(不是動態模擬)。
 */
function samples(scenario: FieldScenarioId, phase: OptimizationPhase, upTo: number): FieldSample[] {
  const out: FieldSample[] = [];
  for (let p = 0; p <= upTo; p += 4) {
    const far = Math.sin((Math.PI * p) / 100);
    const boost = phase === "after" ? 1 : 0;
    if (scenario === "outdoor") {
      out.push({
        progress: p,
        // 受干擾的路段訊號下滑:啟用前掉很多,啟用後只掉一點
        sinrDb: +(19 - (boost ? 3 : 11) * interference(p) + 0.8 * Math.sin(p * 0.7)).toFixed(1),
        dlKbps: 1000 * Math.round((165 + 6 * Math.sin(p * 0.5)) * (1 - (boost ? 0.15 : 0.65) * interference(p))),
        ulKbps: 1000 * +((22 + 1.5 * Math.sin(p * 0.6)) * (1 - (boost ? 0.15 : 0.65) * interference(p))).toFixed(1),
      });
    } else {
      out.push({
        progress: p,
        sinrDb: +(22 - 10 * far + 5 * boost + 1.2 * Math.sin(p * 0.9)).toFixed(1),
        dlKbps: 1000 * Math.round(280 - 120 * far + 60 * boost + 8 * Math.sin(p * 0.6)),
        ulKbps: 1000 * +(45 - 16 * far + 12 * boost + 2 * Math.sin(p * 0.7)).toFixed(1),
      });
    }
  }
  return out;
}

const OUTDOOR_LINK: Record<OptimizationPhase, LinkQuality> = {
  before: {
    sinrDb: 10.4,
    rsrpDbm: -96.0,
    rsrqDb: -12.0,
    rttMs: 34.2,
    dlKbps: 98000,
    ulKbps: 12500,
    cqi: 7,
    pci: 132,
    cellId: 2146306,
    band: "n79",
    nrMode: "SA",
    connected: true,
  },
  after: {
    sinrDb: 17.1,
    rsrpDbm: -84.5,
    rsrqDb: -9.8,
    rttMs: 21.6,
    dlKbps: 141000,
    ulKbps: 21300,
    cqi: 11,
    pci: 132,
    cellId: 2146306,
    band: "n79",
    nrMode: "SA",
    connected: true,
  },
};

const INDOOR_LINK: Record<OptimizationPhase, LinkQuality> = {
  before: {
    sinrDb: 16.0,
    rsrpDbm: -86.2,
    rsrqDb: -10.5,
    rttMs: 28.6,
    dlKbps: 210000,
    ulKbps: 38000,
    cqi: 9,
    pci: 132,
    cellId: 2146306,
    band: "n79",
    nrMode: "SA",
    connected: true,
  },
  after: {
    sinrDb: 21.3,
    rsrpDbm: -74.8,
    rsrqDb: -8.6,
    rttMs: 18.4,
    dlKbps: 268000,
    ulKbps: 52500,
    cqi: 12,
    pci: 132,
    cellId: 2146306,
    band: "n79",
    nrMode: "SA",
    connected: true,
  },
};

/** 第一趟跑完、第二趟跑到 64% */
function runs(scenario: FieldScenarioId, live: { x: number; y: number }, reached: number): FieldRun[] {
  const link = scenario === "outdoor" ? OUTDOOR_LINK : INDOOR_LINK;
  return [
    {
      phase: "before",
      status: "finished",
      progress: 100,
      reachedWaypoints: FIELD_SCENARIOS[scenario].route.length,
      position: null,
      link: link.before,
      samples: samples(scenario, "before", 100),
    },
    {
      phase: "after",
      status: "running",
      progress: 64,
      reachedWaypoints: reached,
      position: live,
      link: link.after,
      samples: samples(scenario, "after", 64),
    },
  ];
}

const MISSIONS: Record<FieldScenarioId, FieldMission> = {
  outdoor: {
    testcase: FIELD_SCENARIOS.outdoor.testcase,
    route: FIELD_SCENARIOS.outdoor.route,
    currentRun: 1,
    vehicle: {
      headingDeg: 315,
      altitudeM: 30.2,
      speedMps: 6.0,
      verticalSpeedMps: 0.1,
      batteryPct: 78,
      satellites: 16,
      mode: "MISSION",
    },
    cameras: [null, null],
    // M3 → C4 中間
    runs: runs("outdoor", { x: 52, y: -122 }, 6),
  },
  indoor: {
    testcase: FIELD_SCENARIOS.indoor.testcase,
    route: FIELD_SCENARIOS.indoor.route,
    currentRun: 1,
    vehicle: {
      headingDeg: 0, // 地圖箭頭:0 = 朝北
      yawDeg: 90, // SLAM yaw:90 = 朝北(顯示用,與上游同一種表示法)
      speedMps: 0.69,
      batteryPct: 88,
      localizationPct: 74,
      mode: "AUTO",
    },
    cameras: [null, null, null, null],
    // C2 → M2 途中:剛從 505 門進辦公區,往北走
    runs: runs("indoor", { x: 35.3, y: -8.5 }, 4),
  },
};

export const mockFieldTestService = {
  async mission(scenario: FieldScenarioId, _opts?: { sinceSeq?: number; signal?: AbortSignal }): Promise<FieldMission> {
    return MISSIONS[scenario];
  },
  /** 即時數值:mock 沒有真的輪詢來源,直接回目前那趟的值 */
  async live(scenario: FieldScenarioId, _signal?: AbortSignal) {
    const mission = MISSIONS[scenario];
    const run = mission.runs[mission.currentRun];
    return {
      link: run?.link ?? null,
      vehicle: mission.vehicle,
      position: run?.position ?? null,
    };
  },
};
