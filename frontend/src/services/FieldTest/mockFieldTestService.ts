import type {
  FieldMission,
  FieldSample,
  FieldScenarioId,
  OptimizationPhase,
  RouteWaypoint,
} from "@/types/fieldTest";

/**
 * 場域測試的假資料(固定值)。
 *
 * 對應的 tester 還沒串,先給中牆一份靜態資料看版面:載具沿同一條路徑跑兩趟,
 * 第一趟「優化前」已跑完、第二趟「優化後」跑到一半。
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
 * 沿路徑每 4% 取一筆。路徑中段離基地台最遠,訊號最差;優化後 SNR、下行吞吐量整體較高。
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
        // 受干擾的路段訊號下滑:優化前掉很多,優化後只掉一點
        snrDb: +(19 - (boost ? 3 : 11) * interference(p) + 0.8 * Math.sin(p * 0.7)).toFixed(1),
        dlMbps: Math.round((165 + 6 * Math.sin(p * 0.5)) * (1 - (boost ? 0.15 : 0.65) * interference(p))),
        ulMbps: +((22 + 1.5 * Math.sin(p * 0.6)) * (1 - (boost ? 0.15 : 0.65) * interference(p))).toFixed(1),
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
        ulMbps: +(45 - 16 * far + 12 * boost + 2 * Math.sin(p * 0.7)).toFixed(1),
      });
    }
  }
  return out;
}

const MISSIONS: Record<FieldScenarioId, FieldMission> = {
  outdoor: {
    testcase: {
      code: "uav.interference_mobility",
      name: "QoE xApp 效能測試",
      environment: "工研院52館外大草坪",
    },
    route: UAV_ROUTE,
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
      },
    ],
  },
  indoor: {
    testcase: {
      code: "amr.interference_mitigation",
      name: "IM xApp 效能測試",
      environment: "工研院51館5樓",
    },
    route: AMR_ROUTE,
    currentRun: 1,
    vehicle: {
      headingDeg: 0,
      speedMps: 0.69,
      batteryPct: 88,
      // 路徑全長約 62.6 m,跑到 64%
      odometerM: 39.4,
      obstacleM: 1.8,
      mode: "AUTO",
    },
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
      },
      {
        phase: "after",
        status: "running",
        progress: 64,
        reachedWaypoints: 4,
        // C2 → M2 途中:剛從 505 門進辦公區,往北走
        position: { x: 35.3, y: -8.5 },
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
      },
    ],
  },
};

export const mockFieldTestService = {
  async mission(scenario: FieldScenarioId): Promise<FieldMission> {
    return MISSIONS[scenario];
  },
};
