"use client";
import { Bot, Plane, Route, Signal, Video, type LucideIcon } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { SceneMap3D } from "@/components/FieldTest/SceneMap3D";
import { ReplayPlayer } from "@/components/FieldTest/ReplayPlayer";
import { RADIO_RING, RouteMap } from "@/components/FieldTest/RouteMap";
import { LiveVideo } from "@/components/Site/LiveVideo";
import {
  FIELD_SCENARIOS,
  type FieldScenario,
  type TrendMetric,
  type TrendSpec,
} from "@/config/fieldScenarios";
import { useFieldTestCamera } from "@/hooks/FieldTest/useFieldTestCamera";
import { useFieldTestLive, type FieldLive } from "@/hooks/FieldTest/useFieldTestLive";
import { useFieldTestMission } from "@/hooks/FieldTest/useFieldTestMission";
import { useFieldTestReplay, type ReplayCamera } from "@/hooks/FieldTest/useFieldTestReplay";
import { useReplayCursor } from "@/hooks/FieldTest/useReplayCursor";
import { useFieldTestScene } from "@/hooks/FieldTest/useFieldTestScene";
import {
  CHART_SURFACE,
  PHASE,
  PROGRESS_COLOR,
  STAGE_COLOR,
  STAGE_LABEL,
  currentStage,
  emptyMission,
  runTime,
  signalReadings,
  vehicleReadings,
  type Reading,
} from "@/lib/fieldView";
import { pickRateUnit } from "@/lib/formatRate";
import { firstGeo, makeGeoProjector, projectMission } from "@/lib/geoProjection";
import type {
  FieldMission,
  FieldRun,
  LinkQuality,
  FieldSample,
  FieldScenarioId,
  FieldVehicleStatus,
  OptimizationPhase,
} from "@/types/fieldTest";

// ── 場域測試中牆(室外 UAV / 室內 AMR)──────────────────────────────────
// 內容依規劃圖 docs/外部文件/前端UI建議/2026-09-13_智慧網路實驗室_室外UAV情境中牆UI規劃.png。
// 測試流程是載具沿同一條路徑跑兩趟(啟用前、啟用後),一次只跑一個測試項目;
// 測項清單在左螢幕,中牆只專注目前這個測試。兩種版面(見 config/fieldScenarios.ts)
// 共用下面的小卡、路徑圖、折線圖。文字避開電視拼接縫,座標與推算見 globals.css .field-wall。
//
// live-results(室外):左即時、右結果
//   ┌ 環境與終端狀態 ─────────────────── ┐ ┌ 測試狀態總覽 │ 測試環境 │ 測試項目 ────────────────────┐
//   │ [固定攝影機 16:9][載具 16:9]   │ │ ┌測試路徑──────────┐ ┌測試數據────────────────────┐ │
//   │ ┌飛行狀態──────┐ ┌UAV 通訊品質┐│ │ │ 測試進度 64% ──── │ │ 平均下行 ● 120 → ● 155 Mbps│ │
//   │ │ 高度 地速 …   │ │ SNR RSSI …││ │ │ 路徑圖(兩趟)    │ │ 上行 ╱╲╱                  │ │
//   └──────────────────────────────────┘ └──────────────────────────────────────────────────────┘
//
// camera-grid(室內):同樣左即時、右結果,但 4 路影像放不進 1/3 寬,所以左右各半
//   ┌ 環境與終端狀態 ───────────────────────────────── ┐ ┌ 測試狀態總覽 │ 測試環境 │ 測試項目 ┐
//   │ [攝影機 1][攝影機 2] ┌行駛狀態────┐        │ │ ┌AMR 測試路徑────────┐ ┌IM 啟用─┐ │
//   │ [攝影機 3][AMR 車載] └AMR 通訊品質┘        │ │ └測試進度 / 路徑圖───┘ └SNR 下行┘ │
//   └──────────────────────────────────────────────┘ └──────────────────────────────────────┘
//
// 資料目前是靜態假資料(見 useFieldTestMission)。

/** 載具狀態小卡的圖示 */
const VEHICLE_ICON: Record<FieldScenarioId, LucideIcon> = { outdoor: Plane, indoor: Bot };

export function FieldTestWall({ scenario }: { scenario: FieldScenarioId }) {
  const sc = FIELD_SCENARIOS[scenario];
  const { mission } = useFieldTestMission(scenario);
  // 即時值另外抓:牆上永遠要是現在的數字,跟有沒有在跑驗測無關
  const { live } = useFieldTestLive(scenario);
  // 還沒有驗測資料(或平台連不上)也要畫出完整版面 —— 欄位名稱、平面圖、路徑都在,
  // 只有值是「—」。牆是無人看顧的,空白畫面看起來像壞了。
  // 車載影像要先確認上游在推流、名額沒滿才掛上去(最後一格是載具車載)
  const { streamUrl } = useFieldTestCamera(scenario);
  // 顯示歷史紀錄時車載那格改播回放 —— 即時串流對跑完的驗測沒有意義,
  // 而且載具多半也不在線,那一格會整片空白。
  const { replay } = useFieldTestReplay(scenario);
  // 骨架要固定同一個物件:平台斷線時(很常見)每次 render 都生新的,會讓 3D 地圖不停重畫
  const empty = useMemo(() => emptyMission(sc, scenario), [sc, scenario]);
  const base = mission ?? empty;
  const data: FieldMission = {
    ...base,
    cameras: base.cameras.map((src, i) => (i === base.cameras.length - 1 ? (streamUrl ?? src) : src)),
  };
  // 只有「平台指定要看這一筆歷史」時才回放(mission.pinned)。
  // 驗測跑完不會自己開始重播 —— 條子停在 100%、數值停在最後一筆,等被切換才進回放。
  //
  // 另外要比對 runId:回放索引 30 秒才重抓一次,切換歷史紀錄的頭幾十秒 replay 裡
  // 還是上一筆的畫面,不擋的話那一格會播錯的影像。
  const running = base.runs.some((r) => r.status === "running");
  const freshReplay = !!replay && !!base.runId && replay.runId === base.runId;
  const replaying = !!base.pinned && !running;
  const replayCam = replaying && freshReplay ? (replay?.cameras?.[0] ?? null) : null;

  return sc.layout === "live-results" ? (
    <LiveResultsLayout scenario={scenario} sc={sc} mission={data} live={live} replaying={replaying} />
  ) : (
    <CameraGridLayout
      scenario={scenario}
      sc={sc}
      mission={data}
      live={live}
      replayCam={replayCam}
      replayPeriodS={replay?.periodS ?? null}
      replaying={replaying}
    />
  );
}

// ── 版面:左即時、右結果(室外)─────────────────────────────────────────

function LiveResultsLayout({
  scenario,
  sc,
  mission,
  live,
  replaying,
}: {
  scenario: FieldScenarioId;
  sc: Extract<FieldScenario, { layout: "live-results" }>;
  mission: FieldMission;
  live: FieldLive | null;
  /** 牆面正在播歷史回放 —— 沒有回放影像的那幾格不要改播即時 */
  replaying: boolean;
}) {
  const run = mission.runs[mission.currentRun];

  // 歷史回放 —— 做法與室內相同(見 CameraGridLayout),差別只在時間軸的來源:
  // 室內以逐格影像為準,室外平台一張都沒存,所以直接用樣本自己的 wall。
  // 驗測正在跑時不回放(牆面本來就在即時更新)。
  const running = mission.runs.some((r) => r.status === "running");
  // 同室內:只有被指定看歷史時才回放,跑完是停在最後的狀態
  const cursor = useReplayCursor(null, null, mission.runs, !!mission.pinned && !running);
  const rs = cursor.sample;
  // 只放這一筆真的有值的欄位:spread 一個 undefined 會把 mission.vehicle 原本的值蓋掉
  const replayVehicle = useMemo(() => {
    if (!rs) return null;
    const v: FieldVehicleStatus = {};
    if (rs.headingDeg != null) v.headingDeg = rs.headingDeg;
    if (rs.speedMps != null) v.speedMps = rs.speedMps;
    if (rs.verticalSpeedMps != null) v.verticalSpeedMps = rs.verticalSpeedMps;
    if (rs.altitudeM != null) v.altitudeM = rs.altitudeM;
    if (rs.batteryPct != null) v.batteryPct = rs.batteryPct;
    if (rs.satellites != null) v.satellites = rs.satellites;
    return v;
  }, [rs]);
  // 把整份 mission 截到「目前播到的時間」——進度條、軌跡、測試數據都是吃它算出來的
  const playMission = useMemo(() => {
    const cut = rs?.wall;
    if (cut == null) return mission;
    const total = sc.route.length;
    return {
      ...mission,
      vehicle: { ...mission.vehicle, ...(replayVehicle ?? {}) },
      runs: mission.runs.map((r) => {
        const kept = (r.samples ?? []).filter((x) => (x.wall ?? 0) <= cut);
        const last = kept.at(-1);
        const progress = last?.progress ?? 0;
        return {
          ...r,
          samples: kept,
          progress,
          reachedWaypoints: Math.round((progress / 100) * total),
          position:
            last && last.x != null && last.y != null ? { x: last.x, y: last.y } : null,
          status: kept.length === 0 ? ("pending" as const) : r.status,
        };
      }),
    };
  }, [mission, rs?.wall, replayVehicle, sc.route.length]);
  // 回放進度:游標的絕對時間落在所有樣本 wall 首尾之間的位置(理由見 MissionProgress)
  const replayPercent = useMemo(() => {
    const cut = rs?.wall;
    if (cut == null) return null;
    const walls = mission.runs
      .flatMap((r) => (r.samples ?? []).map((x) => x.wall))
      .filter((w): w is number => w != null);
    if (walls.length < 2) return null;
    const a = Math.min(...walls);
    const b = Math.max(...walls);
    if (b <= a) return null;
    return Math.round(Math.min(1, Math.max(0, (cut - a) / (b - a))) * 100);
  }, [mission, rs?.wall]);
  const baseLink = live?.link ?? run?.link ?? null;
  const replayLink =
    rs && baseLink
      ? {
          ...baseLink,
          sinrDb: rs.sinrDb ?? null,
          rsrpDbm: rs.rsrpDbm ?? null,
          rsrqDb: rs.rsrqDb ?? null,
          dlKbps: rs.dlKbps ?? null,
          ulKbps: rs.ulKbps ?? null,
          rttMs: rs.rttMs ?? null,
        }
      : null;

  const allRuns = playMission.runs.map((r) => ({ phase: r.phase, samples: r.samples }));
  // 底圖:平台場景的向量地圖(建築 / 道路 / 綠地,公尺座標)
  const { scene } = useFieldTestScene(scenario);
  // UAV 的位置是 GPS,要換成公尺座標才能畫。原點優先用場景的 center —— 跟底圖同一個
  // 原點,軌跡才疊得上;還沒拿到場景就用第一趟第一個 GPS 點(再沒有就用目前位置)
  const origin = scene?.center ?? firstGeo(mission) ?? live?.geo ?? null;
  const project = origin ? makeGeoProjector(origin) : null;
  const mapMission = project ? projectMission(playMission, project) : playMission;
  // 回放時標記走在當下那一筆的 GPS 上(室外樣本只有 lat / lon,沒有 x / y)
  const replayGeo = rs && rs.lat != null && rs.lon != null ? { lat: rs.lat, lon: rs.lon } : null;
  const geoNow = replayGeo ?? live?.geo ?? null;
  const livePos = project && geoNow ? project(geoNow) : null;
  // 3D 地圖的軌跡:只在驗測資料或原點變了才重算。react-query 在資料沒變時會沿用
  // 同一個物件,所以每秒的即時輪詢不會讓 3D 軌跡跟著重建
  const sceneTracks = useMemo(
    () =>
      mapMission.runs.map((r) => ({
        key: r.phase,
        color: PHASE[r.phase].color,
        points: r.samples.flatMap((s) =>
          typeof s.x === "number" && typeof s.y === "number" ? [{ x: s.x, y: s.y }] : [],
        ),
      })),
    // 依據只能是「各趟的樣本筆數」與原點:mission 本身每次 render 都是新物件
    // (外層會補上攝影機位址),拿它當依據等於每秒都重建 3D 軌跡 —— 量過一個分頁會吃掉
    // 2 顆核心。回放時軌跡要跟著長,而截斷唯一會變的就是筆數,所以用它當指紋就夠。
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapMission.runs.map((r) => r.samples.length).join("/"), origin?.lat, origin?.lon],
  );
  const uavX = livePos?.x;
  const uavY = livePos?.y;
  const uavAlt = live?.vehicle.altitudeM ?? null;
  const sceneUav = useMemo(
    () => (uavX !== undefined && uavY !== undefined ? { x: uavX, y: uavY, altM: uavAlt } : null),
    [uavX, uavY, uavAlt],
  );

  return (
    <div className="field-wall">
      {/* ── 左:環境與終端狀態 ── */}
      <section className="dut-wall-band field-card field-card--live">
        <div className="field-card-head">
          <div className="dut-wall-band-title">環境與終端狀態</div>
        </div>
        {/* 左右兩欄:左邊影像、右邊 UAV 與通訊狀態(排法與室內相同)。
            欄距包住 x = 1920 的拼接縫,兩欄的小卡標題列都貼電視的下框線。 */}
        <div className="field-live-grid field-live-grid--two">
          <div className="field-video-grid field-video-grid--one">
            {sc.cameras.map((label, i) => (
              <VideoTile
                key={label}
                label={label}
                src={mission.cameras[i] ?? null}
                scenario={scenario}
                replaying={replaying}
              />
            ))}
          </div>
          <div className="field-live-stack">
            <VehicleSub
              scenario={scenario}
              title={sc.live.vehicleTitle}
              vehicle={{ ...mission.vehicle, ...live?.vehicle, ...(replayVehicle ?? {}) }}
              position={livePos ?? live?.position ?? run?.position ?? null}
              geo={geoNow}
            />
            <SignalSub title={sc.live.signalTitle} link={replayLink ?? baseLink} />
          </div>
        </div>
      </section>

      {/* ── 右:測試狀態總覽(路徑與進度不是「結果」,比較圖也要跑完才算結果,所以不叫測試結果)── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head field-card-head--meta">
          {/* 不放「啟用前 / 啟用後」圖例 —— 跟室內一致(依版面規劃圖) */}
          <HeadRow title="測試狀態總覽" mission={mission} />
        </div>

        <div className="field-status-body field-status-body--results">
          {/* 標題列右側標「現在在做哪一步」—— 進度條只給百分比,看不出是在跑、在裝 xApp
              還是在等(那幾步載具不動,不標會以為卡住了)。文字由平台的方案步驟來。 */}
          <Sub icon={Route} title={sc.routeTitle}>
            <MissionProgress
              mission={playMission}
              single
              percent={replayPercent}
              stage={currentStage(mission.process, replayPercent)}
            />
            {/* 有場景就畫 3D(建築依高度立起來、無人機放在實際高度);
                拿不到場景時退回 2D,只畫 GPS 軌跡 */}
            {scene ? (
              <SceneMap3D scene={scene} tracks={sceneTracks} uav={sceneUav} />
            ) : (
              <RouteMap mission={mapMission} livePosition={livePos} realFrame={!!project} />
            )}
          </Sub>

          {/* 室外情境要呈現的是:在具備干擾的環境中,UAV 移動時傳輸穩不穩定。
              干擾範圍會隨環境變動,畫面上不標固定的干擾區,只呈現兩趟的吞吐量起伏與平均。
              場域內只觀察這台 UAV;上下兩張圖的間距跨 y = 2160 */}
          {/* 跟室內同一組圖:上格平均上行、下格平均下行 */}
          <Sub icon={Signal} title="測試數據" aside={<PhaseLegend />}>
            <div className="field-split">
              <ThroughputCompare runs={playMission.runs} spec={RATE_CHARTS[0]} series={allRuns} />
              <ThroughputCompare runs={playMission.runs} spec={RATE_CHARTS[1]} series={allRuns} />
            </div>
          </Sub>
        </div>
      </section>
    </div>
  );
}

// ── 版面:左右各半、4 路影像(室內)─────────────────────────────────────

function CameraGridLayout({
  scenario,
  sc,
  mission,
  live,
  replayCam,
  replayPeriodS,
  replaying,
}: {
  scenario: FieldScenarioId;
  sc: Extract<FieldScenario, { layout: "camera-grid" }>;
  mission: FieldMission;
  live: FieldLive | null;
  /** 歷史模式才有:車載那格要播的回放鏡頭(沒有回放就是 null)。 */
  replayCam: ReplayCamera | null;
  replayPeriodS: number | null;
  /** 牆面正在播歷史回放 —— 沒有回放影像的那幾格不要改播即時 */
  replaying: boolean;
}) {
  const run = mission.runs[mission.currentRun];

  // 歷史回放:影像、數值卡、地圖標記共用同一個時間點(見 useReplayCursor)。
  // replayCam 為 null(有測試在跑、或這次沒有回放)時 cursor.sample 也是 null,
  // 下面所有 ?? 就會退回原本的即時 / 最後一筆行為。
  const cursor = useReplayCursor(replayCam?.frames ?? null, replayPeriodS, mission.runs);
  const rs = cursor.sample;
  // 回放當下那一筆的載具狀態 —— 沒有回放時是 null,不影響即時模式。
  // 只放「這一筆真的有值」的欄位:spread 一個 undefined 會把底下 mission.vehicle
  // 原本的值蓋成 undefined,地圖箭頭就又沒方向了。
  const replayVehicle = useMemo(() => {
    if (!rs) return null;
    const v: FieldVehicleStatus = {};
    if (rs.yawDeg != null) v.yawDeg = rs.yawDeg;
    if (rs.headingDeg != null) v.headingDeg = rs.headingDeg;
    // 速度 / 電量 / 定位品質樣本裡本來就有(平台後來補的),不帶的話回放時這三格
    // 只能退回即時值 —— 而載具跑完多半已經離線,就整排變成「—」
    if (rs.speedMps != null) v.speedMps = rs.speedMps;
    if (rs.batteryPct != null) v.batteryPct = rs.batteryPct;
    if (rs.localizationPct != null) v.localizationPct = rs.localizationPct;
    return v;
  }, [rs]);
  const replayPosition = rs && rs.x != null && rs.y != null ? { x: rs.x, y: rs.y } : null;
  // 會隨時間變的欄位用回放當下那一筆;頻段 / PCI / 細胞這些樣本裡沒有、
  // 整趟也幾乎不變,沿用既有的 link(它已經是這次驗測最後一筆的值)。
  const baseLink = live?.link ?? run?.link ?? null;
  // 回放時把整份 mission 截到「目前播到的時間」—— 進度條、路徑軌跡、測試數據
  // 三者都是吃 mission 算出來的,不裁的話它們會一直顯示整趟的最終結果,
  // 只有影像與數值卡在動,看起來就像沒跟上。
  //
  // 截法:每一趟只留 wall <= 游標的樣本,progress / reachedWaypoints / position
  // 跟著最後一筆重算。還沒開始的那一趟會變成空的(pending),所以「優化後」的
  // 線會在播到後半段時才長出來。
  const playMission = useMemo(() => {
    const cut = rs?.wall;
    if (cut == null) return mission;
    const total = sc.route.length;
    return {
      ...mission,
      // 地圖箭頭吃的是 mission.vehicle(RouteMap 從 mission 解構),不換的話整段回放
      // 都停在「最後一筆即時狀態」的方向 —— 室內是 98.9°,看起來就是一直指著右邊。
      vehicle: { ...mission.vehicle, ...(replayVehicle ?? {}) },
      runs: mission.runs.map((r) => {
        const kept = (r.samples ?? []).filter((s) => (s.wall ?? 0) <= cut);
        const last = kept.at(-1);
        const progress = last?.progress ?? 0;
        return {
          ...r,
          samples: kept,
          progress,
          reachedWaypoints: Math.round((progress / 100) * total),
          position:
            last && last.x != null && last.y != null ? { x: last.x, y: last.y } : null,
          status: kept.length === 0 ? ("pending" as const) : r.status,
        };
      }),
    };
  }, [mission, rs?.wall, replayVehicle, sc.route.length]);

  // 回放時的「測試進度」—— single 模式的進度條原本讀 mission.process(驗測方案的
  // 步驟進度),歷史紀錄一律是 12/12 = 100%,而且 playMission 沒有截它。回放要的是
  // 「播到整段驗測的哪裡」,所以用游標的絕對時間在首尾樣本之間的比例算。
  const replayPercent = useMemo(() => {
    const cut = rs?.wall;
    if (cut == null) return null;
    const walls = mission.runs
      .flatMap((r) => (r.samples ?? []).map((x) => x.wall))
      .filter((w): w is number => w != null);
    if (walls.length < 2) return null;
    const a = Math.min(...walls);
    const b = Math.max(...walls);
    if (b <= a) return null;
    return Math.round(Math.min(1, Math.max(0, (cut - a) / (b - a))) * 100);
  }, [mission, rs?.wall]);

  const playRuns = useMemo(
    () => playMission.runs.map((r) => ({ phase: r.phase, samples: r.samples })),
    [playMission],
  );

  const replayLink =
    rs && baseLink
      ? {
          ...baseLink,
          sinrDb: rs.sinrDb ?? null,
          rsrpDbm: rs.rsrpDbm ?? null,
          rsrqDb: rs.rsrqDb ?? null,
          dlKbps: rs.dlKbps ?? null,
          ulKbps: rs.ulKbps ?? null,
          rttMs: rs.rttMs ?? null,
        }
      : null;

  return (
    <div className="field-wall field-wall--half">
      {/* ── 左:環境與終端狀態(2×2 影像 + 即時數值)── */}
      <section className="dut-wall-band field-card field-card--live">
        <div className="field-card-head">
          <div className="dut-wall-band-title">環境與終端狀態</div>
        </div>
        {/* 影像與即時小卡的欄距跨 x = 3840 */}
        <div className="field-live-grid">
          <div className="field-video-grid">
            {sc.cameras.map((label, i) => (
              <VideoTile
                key={label}
                label={label}
                src={mission.cameras[i] ?? null}
                // 車載是最後一格;有回放就播回放(見 FieldTestWall 的 replayCam)
                replay={i === sc.cameras.length - 1 ? replayCam : null}
                replayAt={cursor.at}
                scenario={scenario}
                replaying={replaying}
              />
            ))}
          </div>
          {/* 兩張小卡的標題列分別貼第 1、2 排電視的下框線,數值從縫下方 48 起 */}
          <div className="field-live-stack">
            <VehicleSub
              scenario={scenario}
              title={sc.live.vehicleTitle}
              vehicle={{ ...mission.vehicle, ...live?.vehicle, ...(replayVehicle ?? {}) }}
              position={replayPosition ?? live?.position ?? run?.position ?? null}
            />
            <SignalSub
              title={sc.live.signalTitle}
              link={replayLink ?? baseLink}
            />
          </div>
        </div>
      </section>

      {/* ── 右:測試狀態總覽 ── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head field-card-head--meta">
          <HeadRow title="測試狀態總覽" mission={mission} />
        </div>

        <div className="field-status-body">
          {/* 卡頭不放「啟用前 / 啟用後」圖例(依室內版面規劃圖)。
              RU 圖例只在畫向量平面圖時才有意義 —— 有 SLAM 底圖時 RouteMap 不畫 RU 標記 */}
          <Sub
            icon={Route}
            title={sc.routeTitle}
            // 有 SLAM 底圖時不畫 RU 圖例,那個位置改標「現在在做哪一步」(理由同室外)
            aside={sc.floorPlan && !sc.backdrop ? <RadioLegend /> : undefined}
          >
            <MissionProgress
              mission={playMission}
              single
              percent={replayPercent}
              stage={currentStage(mission.process, replayPercent)}
            />
            <RouteMap
              mission={playMission}
              floorPlan={sc.floorPlan}
              backdrop={sc.backdrop}
              livePosition={replayPosition ?? live?.position ?? null}
            />
          </Sub>

          {/* 與室外同一種比較:兩趟的平均與平均差值。
              卡寬 2208 但被 x = 9600 的縫穿過(見 CSS .field-sub--head-past-seam)。
              「平均」寫在每張圖自己的名稱上,標題列就不再重複一次 */}
          <Sub icon={Signal} title="測試數據" className="field-sub--head-past-seam" aside={<PhaseLegend />}>
            <div className="field-split">
              <ThroughputCompare runs={playMission.runs} spec={RATE_CHARTS[0]} series={playRuns} narrow />
              <ThroughputCompare runs={playMission.runs} spec={RATE_CHARTS[1]} series={playRuns} narrow />
            </div>
          </Sub>
        </div>
      </section>
    </div>
  );
}

// ── 共用 ─────────────────────────────────────────────────────────────

/**
 * 右卡標題列:標題 | 測試環境 | 測試項目 | right(可省),各占一台電視寬(間距跨拼接縫)。
 * 測試項目放在同一行,底下的小卡才能往上長。
 */
/**
 * 大卡標題(置中)+ 下面一列測試資訊:測試環境對齊路徑小卡、測試項目對齊測試數據小卡,
 * 兩者都靠左 —— 欄寬與下面的小卡一致(見 globals.css .field-meta-row)。
 */
function HeadRow({ title, mission }: { title: string; mission: FieldMission }) {
  const at = runTime(mission);
  return (
    <>
      <div className="dut-wall-band-title">{title}</div>
      {/* 驗測時間貼卡片右緣、與大卡標題同高(absolute,見 globals.css .field-head-time)——
          牆上要看得出現在顯示的是哪一次,尤其平台指定顯示歷史紀錄時。
          標題會隨「跑完 / 還在跑」在結束時間與開始時間之間切換,見 runTime。 */}
      {at && (
        <span className="field-head-time">
          <span className="field-meta-key">{at.label}</span>
          <span className="field-meta-val">{at.at}</span>
        </span>
      )}
      <div className="field-meta-row">
        <span className="flex min-w-0 items-baseline gap-6">
          <span className="field-meta-key flex-none">測試環境</span>
          <span className="field-meta-val min-w-0 truncate">{mission.testcase.environment}</span>
        </span>
        <span className="field-meta-item flex min-w-0 items-baseline gap-6">
          <span className="field-meta-key flex-none">測試項目</span>
          <span className="field-meta-val min-w-0 truncate">{mission.testcase.name}</span>
        </span>
      </div>
    </>
  );
}


/**
 * 一路影像(16:9):名稱獨立成一條標題列放在畫面上方,樣式與小卡標題列(飛行狀態、
 * 通訊品質)相同 —— 標題列落在上一排電視的下緣,畫面整個放在下一排電視裡。
 */
function VideoTile({
  label,
  src,
  replay,
  replayAt,
  scenario,
  replaying,
}: {
  label: string;
  src: string | null;
  /** 有值就播歷史回放,沒有才走即時串流 */
  replay?: ReplayCamera | null;
  /** 回放播到第幾格(與數值卡、地圖共用同一個游標) */
  replayAt?: number;
  scenario: FieldScenarioId;
  /** 牆面正在播歷史回放(但這一格沒有回放影像) */
  replaying?: boolean;
}) {
  return (
    <div className="field-video-cell">
      <div className="field-video-head">
        <Video className="h-10 w-10 flex-none text-teal" strokeWidth={1.75} />
        <span className="field-sub-title flex-none leading-tight">{label}</span>
      </div>
      <div className="field-video">
        {replay ? (
          <ReplayPlayer scenario={scenario} camera={replay} at={replayAt ?? 0} />
        ) : replaying ? (
          /* 牆面在播歷史,但平台沒有存這支鏡頭的影格(實測只有車載有)。
             這時不能改播即時 —— 畫面會變成「過去的數據配現在的影像」,
             看的人會以為驗測正在進行。跟等串流一樣轉圈就好,標籤要標「回放」。 */
          <LiveVideo src={null} badge="replay" />
        ) : (
          <LiveVideo src={src} />
        )}
      </div>
    </div>
  );
}

function Sub({
  icon: Icon,
  title,
  aside,
  className = "",
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`field-sub ${className}`}>
      {/* 刻意不用 <header>:globals.css 的 `html.wall-mode header` 是給整站 Header 的,
          會把高度撐成兩倍 */}
      <div className="field-sub-head">
        <Icon className="h-10 w-10 flex-none text-teal" strokeWidth={1.75} />
        <span className="field-sub-title flex-none leading-tight">{title}</span>
        {aside && (
          <span className="field-metric-label ml-auto flex-none text-white/60">{aside}</span>
        )}
      </div>
      <div className="field-sub-body">{children}</div>
    </section>
  );
}

/**
 * 3 欄 × 2 列的即時數值:標籤(含單位)在上、數值在下。
 * 小卡縮到 1632 後欄距收成 gap-x-3(36):三欄各 478,裝得下最寬的「RSRP dBm」(474)。
 */
function MetricGrid({ items }: { items: Reading[] }) {
  return (
    /* 列高改成跟著內容(原本是 grid-rows-2,兩列各吃一半高度),並靠上排。
       卡片比內容高不少,舊寫法會把多出來的高度平均分到每一格的上下,每格的
       標籤與數值上下各空出約 45 實際px,看起來鬆散。現在多出來的高度統一留在
       卡片下緣,兩列之間只隔 gap-y-8。標題列不受影響。 */
    <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-x-3 gap-y-8">
      {items.map(({ label, unit, value, tone = "text-white", size = "field-metric-value" }) => (
        <div key={label} className="flex min-w-0 flex-col gap-2">
          <span className="field-metric-label truncate whitespace-nowrap text-white/55">
            {label}
            {unit && <span className="ml-2 text-white/35">{unit}</span>}
          </span>
          <span
            className={`min-w-0 truncate font-semibold leading-[1.1] ${size} ${value === null ? "text-white/40" : tone}`}
          >
            {value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── 即時數值小卡 ─────────────────────────────────────────────────────

/** 飛行狀態 / 行駛狀態 */
function VehicleSub({
  scenario,
  geo,
  title,
  vehicle,
  position,
  className,
}: {
  scenario: FieldScenarioId;
  title: string;
  vehicle: FieldVehicleStatus;
  geo?: { lat: number; lon: number } | null;
  /** 目前這趟的位置(室內顯示 SLAM x / y);沒在跑就是 null */
  position: { x: number; y: number } | null;
  className?: string;
}) {
  return (
    <Sub className={className} icon={VEHICLE_ICON[scenario]} title={title}>
      <MetricGrid items={vehicleReadings(scenario, vehicle, position, geo ?? null)} />
    </Sub>
  );
}

/** UAV / AMR 通訊品質:目前這趟的鏈路數值 */
function SignalSub({
  title,
  link,
  className,
}: {
  title: string;
  link: LinkQuality | null;
  className?: string;
}) {
  return (
    <Sub className={className} icon={Signal} title={title}>
      <MetricGrid items={signalReadings(link)} />
    </Sub>
  );
}

/** RU 的圖例(與平面圖上的 RU 同一個樣子) */
/**
 * 兩趟的顏色對照 —— 掛在「測試數據」的標題列右端。
 *
 * 圖上只有兩條線、沒有任何文字說明哪條是哪一趟,之前靠小卡標題列的平均值旁邊
 * 那兩個點暗示(● 12.4 → ● 18.1),但第二趟還沒資料時那一段整個不顯示,
 * 圖就變成「兩條不知道是什麼的線」。這裡固定標著。
 */
function PhaseLegend() {
  return (
    <span className="field-phase-legend">
      {(["before", "after"] as const).map((p) => (
        <span key={p}>
          <span className="dot" style={{ background: PHASE[p].color }} />
          {PHASE[p].label}
        </span>
      ))}
    </span>
  );
}

function RadioLegend() {
  return (
    <span className="flex items-center gap-3">
      <span
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border-[5px]"
        style={{ borderColor: RADIO_RING, background: CHART_SURFACE }}
      >
        <span className="h-3 w-3 rounded-full" style={{ background: RADIO_RING }} />
      </span>
      RU
    </span>
  );
}

/**
 * 路徑圖上方的測試進度。測試是同一條路徑跑兩趟(先 xApp 未啟用、再啟用)。
 *
 * - 預設(室外):條子分兩半,左半第一趟、右半第二趟,各自填到自己的進度,中間留一道細縫;
 *   顏色對照標題列的啟用前 / 啟用後圖例,右邊大字是目前這趟的百分比。
 * - single(室內,依室內版面規劃圖):一整條,只填「目前這趟」的進度,百分比緊接在
 *   標籤後面;單一顏色,不對應趟次(室內的卡頭已經不放啟用前 / 啟用後圖例)。
 */
function MissionProgress({
  mission,
  single = false,
  percent: override = null,
  stage,
}: {
  mission: FieldMission;
  single?: boolean;
  /** 回放時由外面指定進度(見 replayPercent);即時模式傳 null 就走原本的算法 */
  percent?: number | null;
  /** 現在走到三段的哪一段(見 currentStage)—— 緊接在百分比後面 */
  stage?: string;
}) {
  const run = mission.runs[mission.currentRun];
  if (!run) return null;
  const pct = (r: FieldRun) => Math.round(Math.min(Math.max(r.progress, 0), 100));

  if (single) {
    // 整個驗測流程的進度(已完成的步驟 ÷ 方案總步數),不是行駛進度。
    // 回放時這個值沒有意義(歷史紀錄一律是已完成 = 100%),改吃外面給的比例。
    const p = mission.process;
    const percent = override ?? (p && p.total ? Math.round((p.done / p.total) * 100) : null);
    // 條子分三段:第一趟 / xApp 安裝部署 / 第二趟。切點由後端從方案的步驟推出來
    // (見 transform.stages),所以室內 12 步、室外 10 步各自切在對的地方。
    // 段寬按步數比例分,每一段各自依 done 填;中間那段用不同顏色標出來。
    // 回放時沒有 done,用 percent 反推一個等效的步數。
    const total = p?.total ?? 0;
    const doneSteps = override !== null && total ? (override / 100) * total : (p?.done ?? 0);
    const segs = p?.stages?.length ? p.stages : null;
    return (
      <div className="field-map-head">
        <span className="flex-none text-sm text-white/60">測試進度</span>
        {/* 固定寬度 + 等寬數字:從 5% 跑到 100% 時,後面的條子才不會跟著左右跳 */}
        <span className="field-progress-pct flex-none text-[2.75rem] font-semibold leading-[1.1] text-white">
          {percent === null ? "—" : `${percent}%`}
        </span>
        {/* 階段緊接在百分比後面 —— 原本放在小卡標題列的右端,離進度條太遠,
            看的人要在兩個地方之間來回對 */}
        {stage && <span className="field-progress-stage flex-none">{stage}</span>}
        <div className="field-progress-track field-progress-track--single">
          {/* 規範 09:軌道 rgba(255,255,255,0.15) */}
          {segs ? (
            segs.map((seg) => {
              const span = Math.max(1, seg.to - seg.from);
              const filled = Math.min(1, Math.max(0, (doneSteps - seg.from) / span)) * 100;
              return (
                <div
                  key={seg.kind + seg.from}
                  className="field-progress-seg"
                  style={{ flexGrow: span }}
                  title={STAGE_LABEL[seg.kind]}
                >
                  <div
                    className="field-progress-fill"
                    style={{ width: `${filled}%`, background: STAGE_COLOR[seg.kind] }}
                  />
                </div>
              );
            })
          ) : (
            <div className="field-progress-seg">
              <div className="field-progress-fill" style={{ width: `${percent ?? 0}%`, background: PROGRESS_COLOR }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="field-map-head">
      <span className="flex-none text-sm text-white/60">測試進度</span>
      <div className="field-progress-track">
        {mission.runs.map((r) => (
          /* 規範 09:軌道 rgba(255,255,255,0.15) */
          <div key={r.phase} className="field-progress-seg">
            <div
              className="field-progress-fill"
              style={{ width: `${pct(r)}%`, background: PHASE[r.phase].color }}
            />
          </div>
        ))}
      </div>
      {/* 百分比要說明是哪一趟的,不然兩段條子旁邊一個 64% 看不出在講哪半邊 */}
      <span className="flex flex-none items-baseline gap-3">
        <span
          className="inline-block h-4 w-4 flex-none self-center rounded-full"
          style={{ background: PHASE[run.phase].color }}
        />
        <span className="flex-none text-sm text-white/60">{PHASE[run.phase].label}</span>
        <span className="flex-none text-[2.75rem] font-semibold leading-[1.1] text-white">{pct(run)}%</span>
      </span>
    </div>
  );
}


// ── 折線圖 ───────────────────────────────────────────────────────────

/**
 * 「測試數據」卡的兩張圖,室內外共用:上格平均上行、下格平均下行,都比兩趟的平均
 * (名稱自己帶「平均」)。兩格的高度是由「間距跨縫」反推的,見 globals.css .field-split。
 */
const RATE_CHARTS: [TrendSpec, TrendSpec] = [
  { label: "平均上行", unit: "kbps", metric: "ulKbps", digits: 1, kind: "rate" },
  { label: "平均下行", unit: "kbps", metric: "dlKbps", digits: 0, kind: "rate" },
];

/** 圖表字級與筆畫都以牆面 3× 畫布計:2px 線 = 6、1px 格線 = 3 */
const AXIS_TICK = { fontSize: 72, fill: "rgba(255,255,255,0.6)" };
/**
 * 縱軸刻度:最上面那個不畫(它會頂到軸頂的單位)。
 * index 0 是最低的刻度,visibleTicksCount − 1 就是最上面那個。
 */
function YAxisTick(props: {
  x?: number;
  y?: number;
  index?: number;
  visibleTicksCount?: number;
  payload?: { value?: number | string };
}) {
  const { x = 0, y = 0, index = 0, visibleTicksCount = 0, payload } = props;
  // 回空的 <g> 而不是 null —— Recharts 的 tick 型別要求一定要回傳元素
  if (index >= visibleTicksCount - 1) return <g />;
  return (
    <text
      x={x}
      y={y}
      textAnchor="end"
      dominantBaseline="middle"
      fill={AXIS_TICK.fill}
      fontSize={AXIS_TICK.fontSize}
    >
      {payload?.value}
    </text>
  );
}

/** 橫軸刻度的間隔(秒)。固定值 —— 刻度上的數字永遠是它的整數倍,不由資料算出來 */
const X_TICK_S = 30;
const AXIS_STROKE = "rgba(255,255,255,0.2)";
const GRID_STROKE = "rgba(255,255,255,0.08)";
const TOOLTIP_BOX = {
  background: "rgba(10,23,47,0.94)",
  border: "3px solid rgba(255,255,255,0.2)",
  borderRadius: 16,
  padding: "16px 24px",
  fontSize: 64,
  color: "#FFFFFF",
  lineHeight: 1.4,
} as const;

const sampleValue = (pt: FieldSample | undefined, metric: TrendMetric) => pt?.[metric] ?? null;

/**
 * 一張折線圖:x 為路徑進度(%),一條線一趟。
 * 標題列顯示目前這趟的最新值。多條線時圖例由所屬卡片放一次(單條線由標題說明)。
 * bare = 不畫圖表自己的標題列(由所屬小卡的標題列顯示數值)。
 */
function TrendChart({
  spec: { label, unit, metric, digits },
  series,
  bare = false,
  scale = 1,
  unitOverride,
  digitsOverride,
}: {
  spec: TrendSpec;
  series: { phase: OptimizationPhase; samples: FieldSample[] }[];
  bare?: boolean;
  /** 吞吐量:換成所屬小卡選定的單位,y 軸才跟標題一致 */
  scale?: number;
  unitOverride?: string;
  digitsOverride?: number;
}) {
  const shownUnit = unitOverride ?? unit;
  const shownDigits = digitsOverride ?? digits;
  // 橫軸是「這一趟開始後第幾秒」。每一趟各自從 0 起算 —— elapsedS 是整次驗測的累計
  // 秒數,第二趟接在第一趟後面(實測 before 14.8→121.9、after 151.9→259.5),
  // 不歸零的話兩條線會一左一右,完全沒辦法對照。
  const t0 = new Map<string, number>();
  series.forEach((s) => {
    const first = s.samples.find((pt) => sampleSecond(pt) !== null);
    const sec = first ? sampleSecond(first) : null;
    if (sec !== null) t0.set(s.phase, sec);
  });
  /** 某一筆取樣在自己那一趟的第幾秒 */
  const secIn = (phase: string, pt: FieldSample | undefined): number | null => {
    const sec = sampleSecond(pt);
    return sec === null ? null : Math.round(sec - (t0.get(phase) ?? 0));
  };
  // 依秒數合併成一列一個 x。兩趟的取樣時間點通常對不齊,所以多數列只有其中一趟有值
  // —— 這種空格是「那一趟在這一秒沒有取樣點」,不是資料中斷,要靠 connectNulls 跨過去,
  // 否則每個點都成為孤立線段(配上 strokeLinecap="round" 會被畫成一顆圓點,
  // 整張圖看起來沒有線)。還沒跑到的秒數不在 rows 裡,所以線停在目前位置。
  const byT = new Map<number, Record<string, number>>();
  series.forEach((s) =>
    s.samples.forEach((pt) => {
      const val = sampleValue(pt, metric);
      const t = secIn(s.phase, pt);
      if (val === null || t === null) return;
      const row = byT.get(t) ?? { t };
      row[s.phase] = val / scale;
      byT.set(t, row);
    }),
  );
  const rows = [...byT.values()].sort((a, b) => a.t - b.t);
  // 刻度永遠是 X_TICK_S 的整數倍(0s / 30s / 60s …)—— 不從資料算,所以不會出現
  // 21s、43s 這種跟著每次驗測長度跑的數字。軸長取剛好蓋過資料的那一格,下限 120 秒:
  // 驗測還在跑時軸不會跟著縮放,線畫到哪就停在哪。
  const maxT = rows.length ? rows[rows.length - 1].t : 0;
  const axisMax = Math.max(120, Math.ceil(maxT / X_TICK_S) * X_TICK_S);
  const xTicks: number[] = [];
  for (let v = 0; v <= axisMax; v += X_TICK_S) xTicks.push(v);
  const latest = sampleValue(series[series.length - 1]?.samples.at(-1), metric);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {!bare && (
        <div className="mb-4 flex flex-none items-baseline gap-5">
          <span className="text-sm text-white/60">{label}</span>
          <span className="text-[2.75rem] font-semibold leading-[1.1] text-white">
            {latest === null ? "—" : (latest / scale).toFixed(shownDigits)}
          </span>
          <span className="text-sm text-white/50">{shownUnit}</span>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {/* 縱軸單位:只標一次,放在軸的正上方(繪圖區之外)。
            吞吐量的單位是依兩趟平均動態選的(kbps / Mbps / Gbps),所以吃 shownUnit。
            用 absolute 而不是 Recharts 的 YAxis label —— 後者會被置中到軸寬上,
            剛好疊在最上面那個刻度數字的位置。 */}
        <span className="field-chart-unit">{shownUnit}</span>
        <ResponsiveContainer width="100%" height="100%">
          {/* 上緣留 110 給縱軸的單位標籤 —— 最上面那個刻度的字是以繪圖區頂端為中心
              畫的,留太少單位就會壓在它上面(原本用 Recharts 的 label 就是這樣重疊的) */}
          <LineChart data={rows} margin={{ top: 110, right: 130, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeWidth={3} vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, axisMax]}
              ticks={xTicks}
              tickFormatter={(val: number) => `${val}s`}
              tick={AXIS_TICK}
              tickLine={false}
              tickMargin={44}
              stroke={AXIS_STROKE}
              strokeWidth={3}
              height={130}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickCount={4}
              // 最上面那個刻度不標 —— 它緊貼軸頂的單位。tickCount 只是「提示」,
              // Recharts 仍會自己挑漂亮的數字(給 3 照樣回 4 個),所以改成自訂
              // 畫法,在最後一個(index = 最大)直接不輸出文字,其餘照舊。
              tick={YAxisTick}
              width={150}
              allowDecimals={shownDigits > 0}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 }}
              contentStyle={TOOLTIP_BOX}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              itemStyle={{ color: "#FFFFFF", padding: "4px 0" }}
              labelFormatter={(val) => `第 ${val} 秒`}
              formatter={(val, name) => [
                `${Number(val).toFixed(shownDigits)} ${shownUnit}`,
                PHASE[name as OptimizationPhase]?.short ?? String(name),
              ]}
            />
            {series.map((s) => (
              <Line
                key={s.phase}
                dataKey={s.phase}
                type="monotone"
                stroke={PHASE[s.phase].color}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 12, fill: PHASE[s.phase].color, stroke: CHART_SURFACE, strokeWidth: 6 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
            {/* 每條線的最新一點加端點 */}
            {series.map((s) => {
              const end = s.samples.at(-1);
              const val = sampleValue(end, metric);
              const x = secIn(s.phase, end);
              return end && val !== null && x !== null ? (
                <ReferenceDot
                  key={`end-${s.phase}`}
                  x={x}
                  y={val / scale}
                  r={12}
                  fill={PHASE[s.phase].color}
                  stroke={CHART_SURFACE}
                  strokeWidth={6}
                  ifOverflow="visible"
                />
              ) : null;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/**
 * 一筆取樣的時間(秒)。上游給的是 elapsedS(整次驗測的累計秒數);
 * 沒有就退回絕對時間 wall —— 兩者都是秒,歸零之後效果一樣。
 */
function sampleSecond(pt: FieldSample | undefined): number | null {
  if (!pt) return null;
  if (pt.elapsedS != null) return pt.elapsedS;
  if (pt.wall != null) return pt.wall;
  return null;
}


/**
 * QoE xApp 啟用前後:標題列放兩趟的平均與平均差值,底下是兩趟的折線圖。
 * 後面那趟還在跑,平均只取兩趟都跑過的路徑進度,不然是拿半趟跟整趟比。
 * 兩張卡都橫跨 x = 9600 拼接縫 —— 標題列分左右兩段(間距跨縫),x 刻度改 20% 一格避開縫。
 */
function ThroughputCompare({
  runs,
  spec,
  series,
  narrow = false,
}: {
  runs: FieldRun[];
  spec: TrendSpec;
  series: { phase: OptimizationPhase; samples: FieldSample[] }[];
  /** 窄卡(室內效能卡):標題列排成一行,x 刻度回到 50% 一格 */
  narrow?: boolean;
}) {
  // 每一趟算自己的平均,不互相牽制。
  // 舊做法是兩趟都只算到「兩趟都跑過的進度」(sharedProgress):比較是公平了,
  // 但第一趟明明跑完、數字卻會跟著第二趟的進度一直變,第二趟剛開跑那一刻更會從
  // 整趟平均掉成「前 2% 的平均」,大跳一下。改成各算各的:第一趟跑完就固定,
  // 第二趟邊跑邊累積。需要公平比較的差值則等兩趟都跑完才給(見 delta)。
  const mean = (phase: OptimizationPhase) => {
    const values = (runs.find((r) => r.phase === phase)?.samples ?? [])
      .map((pt) => sampleValue(pt, spec.metric))
      .filter((val): val is number => val !== null);
    return values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : null;
  };
  const before = mean("before");
  const after = mean("after");
  const d = before !== null && after !== null ? after - before : null;
  // 吞吐量:用兩趟平均挑一次單位,數值、差值、y 軸都跟著它
  const chosen =
    spec.kind === "rate"
      ? pickRateUnit([before, after])
      : { unit: spec.unit, scale: 1, digits: spec.digits };
  const fmt = (val: number | null) =>
    val === null ? "—" : (val / chosen.scale).toFixed(chosen.digits);
  const dot = (phase: OptimizationPhase) => (
    <span className="inline-block h-4 w-4 self-center rounded-full" style={{ background: PHASE[phase].color }} />
  );
  /* 沒有要改善的指標(delta === false):不標平均差值,兩趟也用同一個字級與亮度 ——
     放大加亮「啟用後」會看起來像是這個指標被優化過。 */
  const plain = spec.delta === false;
  // 名稱不換行:窄版與寬版共用
  const labelBlock = <span className="whitespace-nowrap text-sm text-white/60">{spec.label}</span>;
  const beforeCls = plain
    ? "text-[2.25rem] font-semibold leading-[1.1] text-white/75"
    : "text-[2.25rem] leading-[1.1] text-white/65";
  const afterCls = plain
    ? "text-[2.25rem] font-semibold leading-[1.1] text-white/75"
    : "text-[2.75rem] font-semibold leading-[1.1] text-white";
  const delta =
    d === null || spec.delta === false ? null : (
      <>
        {d > 0 ? "▲+" : d < 0 ? "▼" : ""}
        {(Math.abs(d) / chosen.scale).toFixed(chosen.digits)}
      </>
    );

  // 第一趟還在跑時不標數值:那時「啟用後」沒有資料,標出來是「12.4 → —」,
  // 既看不出比較、又像是壞掉。等第二趟有資料再整段出現。
  const compared = after !== null;

  return (
    /* min-w-0:grid 項目預設最小寬度是內容寬度,標題列一長就會把整欄撐出小卡 */
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {!compared ? (
        <div className="field-compare-head mb-4 flex-none">{labelBlock}</div>
      ) : narrow ? (
        /* 室內那張卡(內容 x = 9232~11218)被 x = 9600 的縫穿過:縫左邊只剩 320,
           只放得下圖的名稱;數值、單位與平均差值都在縫右邊那 1570。
           「平均」由小卡標題列說明一次,差值貼右緣並小一階字級才放得下 */
        <div className="field-compare-head field-compare-head--half mb-4 flex-none">
          {/* 名稱不換行:左段是照「平均 SINR」的寬度定的,換行會把圖往下擠 */}
          {labelBlock}
          {/* 差值緊跟在數值後面(不推到最右邊),一眼看得出是誰的差值。
              大數字時一行放不下(例:197.0 → 257.0 Mbps ▲+60.0 Mbps 要 1838,縫右邊只有 1567),
              所以允許換行:放不下時差值整段掉到下一行,不會被切掉。每一段各自不換行。 */}
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 whitespace-nowrap">
            <span className="flex items-baseline gap-3">
              {dot("before")}
              <span className={beforeCls}>{fmt(before)}</span>
            </span>
            <span className="text-sm text-white/35">→</span>
            <span className="flex items-baseline gap-3">
              {dot("after")}
              <span className={afterCls}>{fmt(after)}</span>
            </span>
            <span className="text-sm text-white/50">{chosen.unit}</span>
            {delta && (
              // 跟單位只隔 36(gap-x-2 24 + ml-1 12),一眼看得出是誰的差值
              <span className={`ml-1 text-sm font-semibold ${d! >= 0 ? "text-mint" : "text-danger"}`}>
                {delta} {chosen.unit}
              </span>
            )}
          </div>
        </div>
      ) : (
        /* 室外:寫法同室內(名稱自帶「平均」、● 啟用前 → ● 啟用後 單位 差值)。
           這張卡橫跨 x = 9600 的縫,縫剛好在卡片中間。名稱 + 數值 + 差值放不進縫左邊那段
           (量過要 2281,只有 1761),差值只能放縫右邊。為了讓差值貼著數值:數值靠右對齊到
           縫邊(結束在 9552),差值從縫另一側 9648 起,中間只隔電視邊框。名稱仍在最左邊 ——
           名稱與數值之間留白,跟室內「名稱在縫左、數值在縫右」同一種排法。 */
        <div className="field-compare-head mb-4 flex-none">
          <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 whitespace-nowrap">
            {labelBlock}
            <span className="flex items-baseline gap-2">
              <span className="flex items-baseline gap-3">
                {dot("before")}
                <span className={beforeCls}>{fmt(before)}</span>
              </span>
              <span className="text-sm text-white/35">→</span>
              <span className="flex items-baseline gap-3">
                {dot("after")}
                <span className={afterCls}>{fmt(after)}</span>
              </span>
              <span className="text-sm text-white/50">{chosen.unit}</span>
            </span>
          </div>
          <div className="flex min-w-0 items-baseline whitespace-nowrap">
            {delta && (
              <span className={`text-sm font-semibold ${d! >= 0 ? "text-mint" : "text-danger"}`}>
                {delta} {chosen.unit}
              </span>
            )}
          </div>
        </div>
      )}
      <TrendChart
        spec={spec}
        series={series}
        bare
        scale={chosen.scale}
        unitOverride={chosen.unit}
        digitsOverride={chosen.digits}
      />
    </div>
  );
}
