import type { FieldScenario } from "@/config/fieldScenarios";
import { cameraSources } from "@/lib/fieldCameras";
import { formatRate } from "@/lib/formatRate";
import type {
  FieldMission,
  FieldProcess,
  FieldRun,
  FieldScenarioId,
  FieldVehicleStatus,
  LinkQuality,
  OptimizationPhase,
} from "@/types/fieldTest";

// 場域測試的顯示規則 —— 中牆(FieldTestWall)與一般 / 手機版(FieldTestResponsive)共用。
// 兩邊版面不同,但「顯示哪些欄位、顏色代表什麼、階段怎麼叫」必須一致,所以集中在這裡。

/** 圖表與路徑圖的底色(小卡疊在大卡上的近似色),端點外圈用它隔開線條 */
export const CHART_SURFACE = "#16263A";

/**
 * 牆上那個時間要標什麼、顯示哪個時刻。
 *
 * 已結束的那一筆標「驗測結束時間」—— 牆上多半在看跑完的紀錄或回放,結束時間
 * 比開始時間有意義。平台的紀錄沒有結束時間,後端用最後一筆樣本的時間代替。
 * 還在跑的那筆沒有「結束」可言,照舊標開始時間(也才看得出跑多久了)。
 * 兩個都沒有就回 null,呼叫端整段不顯示,不要在牆上留一格「—」。
 */
export function runTime(mission: FieldMission): { label: string; at: string } | null {
  const ended = mission.endedAt ?? null;
  const at = ended ?? mission.createdAt ?? null;
  if (!at) return null;
  return {
    label: ended ? "驗測結束時間" : "驗測開始時間",
    at: new Date(at * 1000).toLocaleString("zh-TW", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

export type Reading = {
  label: string;
  /** 單位放在標籤後面(欄寬窄,接在數值後面會被截斷) */
  unit?: string;
  value: string | number | null;
  tone?: string;
  /** 數值字級(Tailwind class) */
  size?: string;
};


/** 載具即時數值:室外 UAV 與室內 AMR 各看各的參數,都是 3 欄 × 2 列。上游沒給就顯示 — */
export function vehicleReadings(
  scenario: FieldScenarioId,
  v: FieldVehicleStatus,
  position: { x: number; y: number } | null,
  /** UAV 的 GPS —— 回放時是當下那一筆樣本的,即時時是 /live 的 */
  geo: { lat: number; lon: number } | null,
): Reading[] {
  const battery: Reading = {
    label: "電量",
    unit: "%",
    value: v.batteryPct ?? null,
    tone: v.batteryPct !== undefined && v.batteryPct < 30 ? "text-danger" : undefined,
  };
  if (scenario === "indoor") {
    // 照 AMR 即時遙測畫面:SLAM 位置 x / y、yaw、定位品質,再加上速度與電量
    return [
      { label: "位置 x", unit: "m", value: position?.x.toFixed(1) ?? null },
      { label: "位置 y", unit: "m", value: position?.y.toFixed(1) ?? null },
      // 顯示上游的 yaw(-180~180,0 = 朝 +x);地圖箭頭另外用 headingDeg 換算過。
      // 標籤不用「航向」—— 那是羅盤方位(0 = 正北),跟這個值的基準不同,會誤導。
      { label: "車頭方向", unit: "°", value: (v.yawDeg ?? v.headingDeg)?.toFixed(0) ?? null },
      { label: "定位品質", value: v.localizationPct ?? null },
      { label: "速度", unit: "m/s", value: v.speedMps?.toFixed(2) ?? null },
      battery,
    ];
  }
  return [
    // 欄寬窄,「相對高度 m」會被截斷
    { label: "高度", unit: "m", value: v.altitudeM?.toFixed(1) ?? null },
    { label: "速度", unit: "m/s", value: v.speedMps?.toFixed(1) ?? null },
    { label: "垂直速度", unit: "m/s", value: v.verticalSpeedMps?.toFixed(1) ?? null },
    battery,
    // 經緯度拆成兩格:合在一格要放 18 個字,欄寬塞不下。
    // 取 4 位小數 ≈ 11 公尺:場域內仍看得出位置在動(5 位太長,依現場回饋收一位)
    { label: "緯度", unit: "°", value: geo ? geo.lat.toFixed(4) : null },
    { label: "經度", unit: "°", value: geo ? geo.lon.toFixed(4) : null },
  ];
}


/**
 * 通訊品質數值。欄位對齊外部平台的 /live —— 只有 SINR / RSRP / RSRQ / RTT /
 * 吞吐 DL / UL;SNR、RSSI、丟包上游沒有,所以兩個情境都不放。
 * (欄寬 502,「吞吐 DL」配上單位會被截,用 DL / UL。)
 */
export function signalReadings(link: LinkQuality | null): Reading[] {
  // 吞吐量的單位跟著數值跑(kbps / Mbps / Gbps),不然閒置時 Mbps 會全是 0
  const rate = (kbps: number | null | undefined) => formatRate(kbps);
  return [
    { label: "SINR", unit: "dB", value: link?.sinrDb?.toFixed(1) ?? null },
    { label: "RSRP", unit: "dBm", value: link?.rsrpDbm?.toFixed(1) ?? null },
    { label: "RSRQ", unit: "dB", value: link?.rsrqDb?.toFixed(1) ?? null },
    // 原本是 RTT;依現場回饋改顯示服務細胞的 PCI(整數、沒有單位)
    { label: "PCI", value: link?.pci != null ? String(Math.round(link.pci)) : null },
    { label: "DL", ...rate(link?.dlKbps) },
    { label: "UL", ...rate(link?.ulKbps) },
  ];
}


// ── 對照表 ───────────────────────────────────────────────────────────

/**
 * 兩趟的名稱與代表色(路線軌跡、進度條、折線、長條、圖例共用)。
 * 顏色用 dataviz 驗證器在深色底(#16263A)上驗過:亮度帶、彩度、色盲 / 一般視覺分辨度、
 * 對比都通過 —— 規範的 #FFC56B / #80FFE8 太亮,當系列色會失去層次。
 */
export const PHASE: Record<OptimizationPhase, { label: string; short: string; color: string }> = {
  before: { label: "啟用前", short: "啟用前", color: "#C07F22" },
  after: { label: "啟用後", short: "啟用後", color: "#1C9E88" },
};
/** 室內一整條的測試進度用這個色 —— 跟牆上其他綠色狀態一致,不代表哪一趟 */
export const PROGRESS_COLOR = "#1C9E88";
/* 進度條的三段:兩趟維持原本的綠,中間的 xApp 安裝部署另外用藍標出來 ——
   那一段是「牆上看不到載具在動」的時間,不標的話會以為卡住了。 */
export const STAGE_COLOR: Record<string, string> = {
  before: PROGRESS_COLOR,
  deploy: "#5AA9E6",
  after: PROGRESS_COLOR,
  all: PROGRESS_COLOR,
};
/* 三段的名稱。刻意用同一組詞 ——「app 啟動」前 / 中 / 後,三個連著念就知道
   整個驗測在做什麼:先跑一趟、裝上 app 等它起來、再跑一趟比較。
   上游的階段標記室內叫「優化前/後」、室外叫「部署前/後」,兩邊不一致,
   所以牆上不沿用它們的字,統一成這一組。 */
export const STAGE_LABEL: Record<string, string> = {
  // 依現場要求從「部署前 / 中 / 後」改成「啟動前 / 中 / 後」
  before: "app 啟動前",
  deploy: "app 啟動中",
  after: "app 啟動後",
  all: "",
};

/**
 * 標題列右側要顯示的字:現在走到三個階段的哪一個。
 *
 * 一律顯示階段,不顯示「已完成」/「失敗」—— 測試的成敗在別的地方交代,
 * 這一格只回答「進度條上的那個位置是哪一段」。
 *
 * 回放時 process.current 是 null(歷史紀錄一律已完成),所以改用回放游標的
 * 百分比反推步數,階段才會跟著條子一起走。
 */
export function currentStage(
  p: FieldProcess | null | undefined,
  percent: number | null,
): string | undefined {
  const kind = currentStageKind(p, percent);
  return (kind && STAGE_LABEL[kind]) || undefined;
}

/** 同 currentStage,但回傳是哪一段(before / deploy / after)—— 進度條下的三段文字要靠它決定亮哪一個 */
export function currentStageKind(
  p: FieldProcess | null | undefined,
  percent: number | null,
): string | undefined {
  const spans = stageSpans(p);
  const f = percent !== null ? percent / 100 : processFraction(p);
  if (!spans || f === null) return undefined;
  return (spans.find((x) => f >= x.start && f < x.end) ?? spans[spans.length - 1]).kind;
}

/**
 * 整個驗測流程完成了多少(0~1)。後端有依時間加權的 fraction 就用它;
 * 舊格式(沒有 fraction)退回「完成幾步 ÷ 總步數」。
 */
export function processFraction(p: FieldProcess | null | undefined): number | null {
  if (!p) return null;
  if (typeof p.fraction === "number") return p.fraction;
  return p.total ? p.done / p.total : null;
}

/** 進度條的幾段在整條上的起訖(0~1)。後端有給 start / end 就照時間比例,沒有就照步數 */
export function stageSpans(
  p: FieldProcess | null | undefined,
): { kind: string; start: number; end: number }[] | null {
  if (!p?.stages?.length) return null;
  return p.stages.map((x) => ({
    kind: x.kind,
    start: x.start ?? (p.total ? x.from / p.total : 0),
    end: x.end ?? (p.total ? x.to / p.total : 1),
  }));
}

/**
 * 回放播到的時刻 wall,換算成進度條上的位置(0~1)。
 *
 * 進度條按時間加權(兩趟移動佔大半、中間部署只佔一小段),所以不能拿「第一筆到最後一筆
 * 樣本」整段直接線性換算。改成分段對:第一趟的樣本 → 第一趟那一段,第二趟 → 第二趟那一段,
 * 兩趟之間的空檔 → 中間(部署)那段;最後一筆樣本對到 100%,回放播完條子就是滿的。
 * 後端沒給 drives(舊格式)時退回整段線性換算。
 */
export function replayFraction(
  p: FieldProcess | null | undefined,
  runs: FieldRun[],
  wall: number | null | undefined,
): number | null {
  if (wall == null) return null;
  const spans = runs.map((r) => {
    const w = (r.samples ?? []).map((x) => x.wall).filter((x): x is number => x != null);
    return w.length ? ([Math.min(...w), Math.max(...w)] as const) : null;
  });
  const all = spans.flatMap((s) => (s ? [s[0], s[1]] : []));
  if (all.length < 2) return null;
  const a = Math.min(...all);
  const b = Math.max(...all);
  if (b <= a) return null;
  const drives = p?.drives;
  const anchors: [number, number][] = [];
  spans.forEach((s, i) => {
    const d = drives?.[i];
    if (!s || !d) return;
    anchors.push([s[0], d[0]], [s[1], d[1]]);
  });
  if (anchors.length < 2) return Math.min(1, Math.max(0, (wall - a) / (b - a)));
  // 最後一筆樣本 = 100%
  anchors[anchors.length - 1] = [anchors[anchors.length - 1][0], 1];
  if (wall <= anchors[0][0]) return anchors[0][1];
  for (let k = 1; k < anchors.length; k++) {
    const [t0, f0] = anchors[k - 1];
    const [t1, f1] = anchors[k];
    if (wall <= t1) return t1 > t0 ? f0 + ((wall - t0) / (t1 - t0)) * (f1 - f0) : f1;
  }
  return 1;
}

/** 沒資料時的骨架:兩趟都 pending、沒有樣本,其餘取設定檔(影像照樣要播) */
export function emptyMission(sc: FieldScenario, scenario: FieldScenarioId): FieldMission {
  const blank = (phase: OptimizationPhase): FieldRun => ({
    phase,
    status: "pending",
    progress: 0,
    reachedWaypoints: 0,
    position: null,
    link: null,
    samples: [],
  });
  return {
    testcase: sc.testcase,
    route: sc.route,
    currentRun: 1,
    runs: [blank("before"), blank("after")],
    vehicle: {},
    cameras: cameraSources(scenario),
  };
}

/** 某一趟、某個指標的平均(跟「測試數據」那兩張圖同一套算法:各趟各算各的) */
export function phaseMean(runs: FieldRun[], phase: OptimizationPhase, metric: "ulKbps" | "dlKbps"): number | null {
  const vals = (runs.find((r) => r.phase === phase)?.samples ?? [])
    .map((s) => s[metric])
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

/**
 * 啟用後相對啟用前的平均提升(%)。兩趟都要有資料;啟用前是 0 時算不出比例,回 null。
 */
export function meanGainPct(runs: FieldRun[], metric: "ulKbps" | "dlKbps"): number | null {
  const before = phaseMean(runs, "before", metric);
  const after = phaseMean(runs, "after", metric);
  if (before === null || after === null || before === 0) return null;
  return ((after - before) / before) * 100;
}
