import type { OptimizationPhase, OutdoorMission, OutdoorSample, UavWaypoint } from "@/types/outdoor";

/**
 * 室外 UAV 情境的假資料(固定值)。
 *
 * 室外 tester 還沒串,先給中牆一份靜態資料看版面:無人機沿同一條航線飛兩趟,
 * 第一趟「優化開啟前」已飛完、第二趟「優化開啟後」飛到一半。
 */

// 公尺,起飛點為原點,x 向東、y 向北。
const ROUTE: UavWaypoint[] = [
  { id: "H", kind: "takeoff", x: 0, y: 0 },
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
 * 沿航線每 4% 取一筆。航線中段離基地台最遠,訊號最差;優化開啟後 SNR、下行速率整體較高。
 * 用固定公式算出來,每次都一樣(不是動態模擬)。
 */
function samples(phase: OptimizationPhase, upTo: number): OutdoorSample[] {
  const out: OutdoorSample[] = [];
  for (let p = 0; p <= upTo; p += 4) {
    const far = Math.sin((Math.PI * p) / 100);
    const climb = Math.min(p / 12, 1);
    const cruising = climb === 1;
    const boost = phase === "after" ? 1 : 0;
    out.push({
      progress: p,
      altitudeM: +(30 * climb + (cruising ? 0.4 * Math.sin(p * 0.9) : 0)).toFixed(1),
      groundSpeedMps: +(6 * climb + (cruising ? 0.3 * Math.sin(p * 1.3) : 0)).toFixed(1),
      snrDb: +(14 - 9 * far + 6.5 * boost + 0.8 * Math.sin(p * 0.7)).toFixed(1),
      dlMbps: Math.round(160 - 95 * far + 45 * boost + 6 * Math.sin(p * 0.5)),
    });
  }
  return out;
}

const MISSION: OutdoorMission = {
  testcase: { code: "uav.waypoint_coverage", procedure: "Waypoint Coverage Measurement" },
  route: ROUTE,
  currentRun: 1,
  runs: [
    {
      phase: "before",
      status: "finished",
      progress: 100,
      reachedWaypoints: ROUTE.length,
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
      samples: samples("before", 100),
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
      samples: samples("after", 64),
    },
  ],
  flight: {
    altitudeM: 30.2,
    groundSpeedMps: 6.0,
    verticalSpeedMps: 0.1,
    batteryPct: 78,
    satellites: 16,
    mode: "MISSION",
    headingDeg: 315,
    distanceM: 133,
    flightTimeSec: 79,
  },
  cameras: { fixed: null, uav: null },
};

export const mockOutdoorService = {
  async mission(): Promise<OutdoorMission> {
    return MISSION;
  },
};
