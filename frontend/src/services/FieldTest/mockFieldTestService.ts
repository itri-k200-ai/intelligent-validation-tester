import type {
  FieldMission,
  FieldSample,
  FieldScenarioId,
  FieldUeSeries,
  OptimizationPhase,
  RouteWaypoint,
} from "@/types/fieldTest";

/**
 * 場域測試的假資料(固定值)。
 *
 * 對應的 tester 還沒串,先給中牆一份靜態資料看版面:載具沿同一條路徑跑兩趟,
 * 第一趟「優化開啟前」已跑完、第二趟「優化開啟後」跑到一半。
 */

// 公尺,出發點為原點,x 向東、y 向北。
/** 室外:無人機菱形航線 */
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

/** 室內:AMR 在廠房走道來回(S 形),最後回到出發點旁 */
const AMR_ROUTE: RouteWaypoint[] = [
  { id: "S", kind: "start", x: 0, y: 0 },
  { id: "A1", kind: "checkpoint", x: 36, y: 0 },
  { id: "A2", kind: "mission", x: 36, y: -8 },
  { id: "B1", kind: "checkpoint", x: 0, y: -8 },
  { id: "B2", kind: "mission", x: 0, y: -16 },
  { id: "C1", kind: "checkpoint", x: 36, y: -16 },
  { id: "C2", kind: "mission", x: 36, y: -24 },
  { id: "D1", kind: "checkpoint", x: -4, y: -24 },
  { id: "R", kind: "return", x: -4, y: 0 },
];

/**
 * 沿路徑每 4% 取一筆。路徑中段離基地台最遠,訊號最差;優化開啟後 SNR、下行速率整體較高。
 * 用固定公式算出來,每次都一樣(不是動態模擬)。
 */
function samples(scenario: FieldScenarioId, phase: OptimizationPhase, upTo: number): FieldSample[] {
  const out: FieldSample[] = [];
  for (let p = 0; p <= upTo; p += 4) {
    const far = Math.sin((Math.PI * p) / 100);
    const boost = phase === "after" ? 1 : 0;
    if (scenario === "outdoor") {
      const climb = Math.min(p / 12, 1);
      const cruising = climb === 1;
      out.push({
        progress: p,
        altitudeM: +(30 * climb + (cruising ? 0.4 * Math.sin(p * 0.9) : 0)).toFixed(1),
        speedMps: +(6 * climb + (cruising ? 0.3 * Math.sin(p * 1.3) : 0)).toFixed(1),
        batteryPct: Math.round(98 - p * 0.2),
        snrDb: +(14 - 9 * far + 6.5 * boost + 0.8 * Math.sin(p * 0.7)).toFixed(1),
        dlMbps: Math.round(160 - 95 * far + 45 * boost + 6 * Math.sin(p * 0.5)),
      });
    } else {
      // 每走完一排走道要轉彎減速(轉角約每 1/8 路徑一個)
      const straight = Math.abs(Math.sin((Math.PI * p) / 12.5));
      out.push({
        progress: p,
        speedMps: +(p === 0 ? 0 : 0.4 + 0.8 * straight).toFixed(2),
        batteryPct: Math.round(96 - p * 0.12),
        snrDb: +(22 - 10 * far + 5 * boost + 1.2 * Math.sin(p * 0.9)).toFixed(1),
        dlMbps: Math.round(280 - 120 * far + 60 * boost + 8 * Math.sin(p * 0.6)),
      });
    }
  }
  return out;
}

/** 假設場域內有 10 台 UE */
const UE_COUNT = 10;

/**
 * 各 UE 的吞吐量:每台位置不同、基準速率不同;載具經過附近時該 UE 會掉速;
 * 優化開啟後整體提高。固定公式,不是動態模擬。
 */
function ueThroughput(scenario: FieldScenarioId, phase: OptimizationPhase, upTo: number): FieldUeSeries[] {
  const base = scenario === "outdoor" ? 90 : 180;
  const lift = phase === "after" ? base * 0.3 : 0;
  return Array.from({ length: UE_COUNT }, (_, i) => {
    const ueBase = base * (0.6 + 0.08 * i);
    const samples = [];
    for (let p = 0; p <= upTo; p += 4) {
      const passing = 0.3 * Math.max(0, Math.sin((Math.PI * (p - i * 9)) / 30));
      const mbps = Math.max(5, Math.round(ueBase * (1 - passing) + lift + 6 * Math.sin(p * 0.4 + i)));
      samples.push({ progress: p, mbps });
    }
    return { ue: `UE-${String(i + 1).padStart(2, "0")}`, samples };
  });
}

const MISSIONS: Record<FieldScenarioId, FieldMission> = {
  outdoor: {
    testcase: { code: "uav.waypoint_coverage", procedure: "Waypoint Coverage Measurement" },
    route: UAV_ROUTE,
    currentRun: 1,
    headingDeg: 315,
    cameras: [null, null],
    runs: [
      {
        phase: "before",
        status: "finished",
        progress: 100,
        reachedWaypoints: UAV_ROUTE.length,
        position: null,
        link: {
          snrDb: 9.0,
          sinrDb: 10.4,
          rssiDbm: -96.0,
          rsrqDb: -12.0,
          dlMbps: 98,
          ulMbps: 12.5,
          packetLossPct: 1.8,
          cqi: 7,
          band: "n79",
          nrMode: "SA",
        },
        samples: samples("outdoor", "before", 100),
        ueThroughput: ueThroughput("outdoor", "before", 100),
      },
      {
        phase: "after",
        status: "running",
        progress: 64,
        reachedWaypoints: 6,
        // M3 → C4 中間
        position: { x: 52, y: -122 },
        link: {
          snrDb: 15.6,
          sinrDb: 17.1,
          rssiDbm: -89.5,
          rsrqDb: -9.8,
          dlMbps: 141,
          ulMbps: 21.3,
          packetLossPct: 0.4,
          cqi: 11,
          band: "n79",
          nrMode: "SA",
        },
        samples: samples("outdoor", "after", 64),
        ueThroughput: ueThroughput("outdoor", "after", 64),
      },
    ],
  },
  indoor: {
    testcase: { code: "amr.aisle_coverage", procedure: "Indoor Aisle Coverage Measurement" },
    route: AMR_ROUTE,
    currentRun: 1,
    headingDeg: 180,
    cameras: [null, null, null, null],
    runs: [
      {
        phase: "before",
        status: "finished",
        progress: 100,
        reachedWaypoints: AMR_ROUTE.length,
        position: null,
        link: {
          snrDb: 15.2,
          sinrDb: 16.0,
          rssiDbm: -78.5,
          rsrqDb: -10.5,
          dlMbps: 210,
          ulMbps: 38.0,
          packetLossPct: 0.9,
          cqi: 9,
          band: "n79",
          nrMode: "SA",
        },
        samples: samples("indoor", "before", 100),
        ueThroughput: ueThroughput("indoor", "before", 100),
      },
      {
        phase: "after",
        status: "running",
        progress: 64,
        reachedWaypoints: 6,
        // C1 → C2 中間,往南走
        position: { x: 36, y: -20 },
        link: {
          snrDb: 20.4,
          sinrDb: 21.3,
          rssiDbm: -72.0,
          rsrqDb: -8.6,
          dlMbps: 268,
          ulMbps: 52.5,
          packetLossPct: 0.2,
          cqi: 12,
          band: "n79",
          nrMode: "SA",
        },
        samples: samples("indoor", "after", 64),
        ueThroughput: ueThroughput("indoor", "after", 64),
      },
    ],
  },
};

export const mockFieldTestService = {
  async mission(scenario: FieldScenarioId): Promise<FieldMission> {
    return MISSIONS[scenario];
  },
};
