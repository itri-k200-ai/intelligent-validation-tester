"use client";
import { Bot, Plane, Route, Signal, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
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

import { LiveVideo } from "@/components/Site/LiveVideo";
import type { FieldBackdrop, FloorPlan, FloorRect } from "@/config/floorPlans";
import {
  FIELD_SCENARIOS,
  type FieldScenario,
  type TrendMetric,
  type TrendSpec,
} from "@/config/fieldScenarios";
import { useFieldTestCamera } from "@/hooks/FieldTest/useFieldTestCamera";
import { useFieldTestLive, type FieldLive } from "@/hooks/FieldTest/useFieldTestLive";
import { useFieldTestMission } from "@/hooks/FieldTest/useFieldTestMission";
import { cameraSources } from "@/lib/fieldCameras";
import { formatRate, pickRateUnit } from "@/lib/formatRate";
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
//   ┌ 即時狀態 ───────────────────── ┐ ┌ 測試狀態總覽 │ 測試環境 │ 測試項目 ────────────────────┐
//   │ [固定攝影機 16:9][載具 16:9]   │ │ ┌測試路徑──────────┐ ┌測試數據────────────────────┐ │
//   │ ┌飛行狀態──────┐ ┌UAV 通訊品質┐│ │ │ 測試進度 64% ──── │ │ 平均下行 ● 120 → ● 155 Mbps│ │
//   │ │ 高度 地速 …   │ │ SNR RSSI …││ │ │ 路徑圖(兩趟)    │ │ 上行 ╱╲╱                  │ │
//   └──────────────────────────────────┘ └──────────────────────────────────────────────────────┘
//
// camera-grid(室內):同樣左即時、右結果,但 4 路影像放不進 1/3 寬,所以左右各半
//   ┌ 即時狀態 ─────────────────────────────────── ┐ ┌ 測試狀態總覽 │ 測試環境 │ 測試項目 ┐
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
  const base = mission ?? emptyMission(sc, scenario);
  const data: FieldMission = {
    ...base,
    cameras: base.cameras.map((src, i) => (i === base.cameras.length - 1 ? (streamUrl ?? src) : src)),
  };

  return sc.layout === "live-results" ? (
    <LiveResultsLayout scenario={scenario} sc={sc} mission={data} live={live} />
  ) : (
    <CameraGridLayout scenario={scenario} sc={sc} mission={data} live={live} />
  );
}

/** 沒資料時的骨架:兩趟都 pending、沒有樣本,其餘取設定檔(影像照樣要播) */
function emptyMission(sc: FieldScenario, scenario: FieldScenarioId): FieldMission {
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

// ── 版面:左即時、右結果(室外)─────────────────────────────────────────

function LiveResultsLayout({
  scenario,
  sc,
  mission,
  live,
}: {
  scenario: FieldScenarioId;
  sc: Extract<FieldScenario, { layout: "live-results" }>;
  mission: FieldMission;
  live: FieldLive | null;
}) {
  const run = mission.runs[mission.currentRun];
  const allRuns = mission.runs.map((r) => ({ phase: r.phase, samples: r.samples }));
  const upTo = sharedProgress(mission.runs);

  return (
    <div className="field-wall">
      {/* ── 左:即時狀態 ── */}
      <section className="dut-wall-band field-card field-card--video">
        <div className="dut-wall-band-title">即時狀態</div>
        <div className="field-video-row">
          {sc.cameras.map((label, i) => (
            <VideoTile key={label} label={label} src={mission.cameras[i] ?? null} />
          ))}
        </div>
        {/* 兩張即時小卡並排,間距跨 x = 1920 */}
        <div className="field-live-row">
          <VehicleSub
            className="field-sub--lower"
            scenario={scenario}
            title={sc.live.vehicleTitle}
            vehicle={{ ...mission.vehicle, ...live?.vehicle }}
            position={live?.position ?? run?.position ?? null}
          />
          <SignalSub
            className="field-sub--lower"
            title={sc.live.signalTitle}
            link={live?.link ?? run?.link ?? null}
          />
        </div>
      </section>

      {/* ── 右:測試狀態總覽(路徑與進度不是「結果」,比較圖也要跑完才算結果,所以不叫測試結果)── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head">
          {/* 不放「啟用前 / 啟用後」圖例 —— 跟室內一致(依版面規劃圖) */}
          <HeadRow title="測試狀態總覽" mission={mission} />
        </div>

        <div className="field-status-body field-status-body--results">
          <Sub icon={Route} title={sc.routeTitle}>
            <MissionProgress mission={mission} single />
            <RouteMap mission={mission} livePosition={live?.position ?? null} />
          </Sub>

          {/* 室外情境要呈現的是:在具備干擾的環境中,UAV 移動時傳輸穩不穩定。
              干擾範圍會隨環境變動,畫面上不標固定的干擾區,只呈現兩趟的吞吐量起伏與平均。
              場域內只觀察這台 UAV;上下兩張圖的間距跨 y = 2160 */}
          {/* 跟室內同一組圖:上格吞吐量(DL / UL 開關切換),下格 SINR */}
          <Sub icon={Signal} title="測試數據">
            <div className="field-split">
              <ThroughputCompare
                runs={mission.runs}
                spec={RATE_CHARTS[0]}
                alt={RATE_CHARTS[1]}
                series={allRuns}
                upTo={upTo}
              />
              <ThroughputCompare runs={mission.runs} spec={SINR_CHART} series={allRuns} upTo={upTo} />
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
}: {
  scenario: FieldScenarioId;
  sc: Extract<FieldScenario, { layout: "camera-grid" }>;
  mission: FieldMission;
  live: FieldLive | null;
}) {
  const run = mission.runs[mission.currentRun];
  const allRuns = mission.runs.map((r) => ({ phase: r.phase, samples: r.samples }));
  const upTo = sharedProgress(mission.runs);

  return (
    <div className="field-wall field-wall--half">
      {/* ── 左:即時狀態(2×2 影像 + 即時數值)── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head">
          <div className="dut-wall-band-title">即時狀態</div>
        </div>
        {/* 影像與即時小卡的欄距跨 x = 3840 */}
        <div className="field-live-grid">
          <div className="field-video-grid">
            {sc.cameras.map((label, i) => (
              <VideoTile key={label} label={label} src={mission.cameras[i] ?? null} />
            ))}
          </div>
          {/* 上卡標題列對齊右卡小卡;下卡標題列在 y = 2160 之上、數值從 y = 2208 起 */}
          <div className="field-live-stack">
            <VehicleSub
              scenario={scenario}
              title={sc.live.vehicleTitle}
              vehicle={{ ...mission.vehicle, ...live?.vehicle }}
              position={live?.position ?? run?.position ?? null}
            />
            <SignalSub
              className="field-sub--lower"
              title={sc.live.signalTitle}
              link={live?.link ?? run?.link ?? null}
            />
          </div>
        </div>
      </section>

      {/* ── 右:測試狀態總覽 ── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head">
          <HeadRow title="測試狀態總覽" mission={mission} />
        </div>

        <div className="field-status-body">
          {/* 卡頭不放「啟用前 / 啟用後」圖例(依室內版面規劃圖)。
              RU 圖例只在畫向量平面圖時才有意義 —— 有 SLAM 底圖時 RouteMap 不畫 RU 標記 */}
          <Sub
            icon={Route}
            title={sc.routeTitle}
            aside={sc.floorPlan && !sc.backdrop ? <RadioLegend /> : undefined}
          >
            <MissionProgress mission={mission} single />
            <RouteMap
              mission={mission}
              floorPlan={sc.floorPlan}
              backdrop={sc.backdrop}
              livePosition={live?.position ?? null}
            />
          </Sub>

          {/* 與室外同一種比較:兩趟的平均與平均差值。
              卡寬 2208 但被 x = 9600 的縫穿過(見 CSS .field-sub--head-past-seam)。
              「平均」寫在每張圖自己的名稱上,標題列就不再重複一次 */}
          <Sub icon={Signal} title="測試數據" className="field-sub--head-past-seam">
            <div className="field-split">
              <ThroughputCompare
                runs={mission.runs}
                spec={RATE_CHARTS[0]}
                alt={RATE_CHARTS[1]}
                series={allRuns}
                upTo={upTo}
                narrow
              />
              <ThroughputCompare runs={mission.runs} spec={SINR_CHART} series={allRuns} upTo={upTo} narrow />
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
function HeadRow({ title, mission, right }: { title: string; mission: FieldMission; right?: ReactNode }) {
  return (
    <div className="field-head-row">
      <div className="dut-wall-band-title">{title}</div>
      {/* 測試環境靠右 —— 這一欄的右界就是路徑小卡的右緣,貼齊才不會看起來飄在中間 */}
      <span className="flex min-w-0 items-baseline justify-end gap-6">
        <span className="flex-none text-sm text-white/55">測試環境</span>
        <span className="min-w-0 truncate text-base">{mission.testcase.environment}</span>
      </span>
      <span className="flex min-w-0 items-baseline gap-6">
        <span className="flex-none text-sm text-white/55">測試項目</span>
        <span className="min-w-0 truncate text-base font-semibold">{mission.testcase.name}</span>
      </span>
      {right}
    </div>
  );
}


/** 一格影像(16:9),名稱疊在左下 */
function VideoTile({ label, src }: { label: string; src: string | null }) {
  return (
    <div className="field-video">
      <LiveVideo src={src} />
      <span className="field-video-label">{label}</span>
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
        <span className="flex-none text-[2.5rem] font-semibold leading-tight">{title}</span>
        {aside && <span className="ml-auto min-w-0 truncate text-sm text-white/60">{aside}</span>}
      </div>
      <div className="field-sub-body">{children}</div>
    </section>
  );
}

type Reading = {
  label: string;
  /** 單位放在標籤後面(欄寬窄,接在數值後面會被截斷) */
  unit?: string;
  value: string | number | null;
  tone?: string;
  /** 數值字級(Tailwind class) */
  size?: string;
};

/**
 * 3 欄 × 2 列的即時數值:標籤(含單位)在上、數值在下。
 * 小卡縮到 1632 後欄距收成 gap-x-3(36):三欄各 478,裝得下最寬的「RSRP dBm」(474)。
 */
function MetricGrid({ items }: { items: Reading[] }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-x-3">
      {items.map(({ label, unit, value, tone = "text-white", size = "text-[2.75rem]" }) => (
        <div key={label} className="flex min-w-0 flex-col justify-center gap-2">
          <span className="truncate whitespace-nowrap text-sm text-white/55">
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

/** 載具即時數值:室外 UAV 與室內 AMR 各看各的參數,都是 3 欄 × 2 列。上游沒給就顯示 — */
function vehicleReadings(
  scenario: FieldScenarioId,
  v: FieldVehicleStatus,
  position: { x: number; y: number } | null,
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
      // 顯示上游的 yaw(-180~180);地圖箭頭另外用 headingDeg 換算過
      { label: "yaw", unit: "°", value: (v.yawDeg ?? v.headingDeg)?.toFixed(0) ?? null },
      { label: "定位品質", value: v.localizationPct ?? null },
      { label: "速度", unit: "m/s", value: v.speedMps?.toFixed(2) ?? null },
      battery,
    ];
  }
  return [
    // 欄寬窄,「相對高度 m」會被截斷
    { label: "高度", unit: "m", value: v.altitudeM?.toFixed(1) ?? null },
    { label: "地速", unit: "m/s", value: v.speedMps?.toFixed(1) ?? null },
    { label: "垂直", unit: "m/s", value: v.verticalSpeedMps?.toFixed(1) ?? null },
    battery,
    { label: "衛星數", value: v.satellites ?? null },
    // 模式字串較長,字級小一階才放得進欄寬
    { label: "模式", value: v.mode ?? null, size: "text-[2rem]" },
  ];
}

/** 飛行狀態 / 行駛狀態 */
function VehicleSub({
  scenario,
  title,
  vehicle,
  position,
  className,
}: {
  scenario: FieldScenarioId;
  title: string;
  vehicle: FieldVehicleStatus;
  /** 目前這趟的位置(室內顯示 SLAM x / y);沒在跑就是 null */
  position: { x: number; y: number } | null;
  className?: string;
}) {
  return (
    <Sub className={className} icon={VEHICLE_ICON[scenario]} title={title}>
      <MetricGrid items={vehicleReadings(scenario, vehicle, position)} />
    </Sub>
  );
}

/**
 * 通訊品質數值。欄位對齊外部平台的 /live —— 只有 SINR / RSRP / RSRQ / RTT /
 * 吞吐 DL / UL;SNR、RSSI、丟包上游沒有,所以兩個情境都不放。
 * (欄寬 502,「吞吐 DL」配上單位會被截,用 DL / UL。)
 */
function signalReadings(link: LinkQuality | null): Reading[] {
  // 吞吐量的單位跟著數值跑(kbps / Mbps / Gbps),不然閒置時 Mbps 會全是 0
  const rate = (kbps: number | null | undefined) => formatRate(kbps);
  return [
    { label: "SINR", unit: "dB", value: link?.sinrDb?.toFixed(1) ?? null },
    { label: "RSRP", unit: "dBm", value: link?.rsrpDbm?.toFixed(1) ?? null },
    { label: "RSRQ", unit: "dB", value: link?.rsrqDb?.toFixed(1) ?? null },
    { label: "RTT", unit: "ms", value: link?.rttMs?.toFixed(1) ?? null },
    { label: "DL", ...rate(link?.dlKbps) },
    { label: "UL", ...rate(link?.ulKbps) },
  ];
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

// ── 測試路徑 ─────────────────────────────────────────────────────────

/**
 * 路線圖:兩趟軌跡(啟用前 / 啟用後)與載具目前位置。
 *
 * 兩種底:
 *  - 有 backdrop(圖檔 + extent):用世界座標畫,軌跡取載具實際回報的座標 ——
 *    圖與座標同一個系,不必校正。視野自動縮到活動範圍,不然整層樓只有一小段有東西。
 *  - 沒有 backdrop:畫向量平面圖與規劃路線(室外沒有底圖,就只有路線)。
 */
function RouteMap({
  mission,
  floorPlan,
  backdrop,
  livePosition,
}: {
  mission: FieldMission;
  floorPlan?: FloorPlan;
  backdrop?: FieldBackdrop;
  /** 即時位置(來自 /live);沒有就用目前那趟的最後位置 */
  livePosition?: { x: number; y: number } | null;
}) {
  const { route, runs, vehicle } = mission;
  const live = livePosition ?? runs[mission.currentRun]?.position ?? null;
  const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x},${-p.y}`).join(" ");

  // 每趟的實際軌跡(樣本裡的座標);沒有座標的樣本(例如 UAV 只有 GPS)就沒有軌跡
  const tracks = runs.map((r) => ({
    phase: r.phase,
    points: r.samples
      .filter((s): s is typeof s & { x: number; y: number } =>
        typeof s.x === "number" && typeof s.y === "number",
      )
      .map((s) => ({ x: s.x, y: s.y })),
  }));

  // 視野:有底圖就看「軌跡 + 目前位置」,並留邊、夾在底圖範圍內
  const focus = [...tracks.flatMap((t) => t.points), ...(live ? [live] : [])];
  const view = floorPlan?.view;
  let minX: number;
  let minY: number;
  let spanX: number;
  let spanY: number;
  if (backdrop) {
    const ext = backdrop.extent;
    const margin = 6;
    const x0 = focus.length ? Math.max(ext.xMin, Math.min(...focus.map((p) => p.x)) - margin) : ext.xMin;
    const x1 = focus.length ? Math.min(ext.xMax, Math.max(...focus.map((p) => p.x)) + margin) : ext.xMax;
    const y0 = focus.length ? Math.max(ext.yMin, Math.min(...focus.map((p) => p.y)) - margin) : ext.yMin;
    const y1 = focus.length ? Math.min(ext.yMax, Math.max(...focus.map((p) => p.y)) + margin) : ext.yMax;
    minX = x0;
    minY = -y1;
    spanX = Math.max(x1 - x0, 1);
    spanY = Math.max(y1 - y0, 1);
  } else {
    const extent = view
      ? [
          { x: view.x1, y: view.y1 },
          { x: view.x2, y: view.y2 },
        ]
      : [...route, ...(live ? [live] : [])];
    const xs = extent.map((p) => p.x);
    const ys = extent.map((p) => -p.y);
    minX = Math.min(...xs);
    minY = Math.min(...ys);
    spanX = Math.max(...xs) - minX;
    spanY = Math.max(...ys) - minY;
  }
  // u = 一個視覺單位:線寬、點大小都乘它,範圍不管幾公尺比例都一致
  const u = Math.max(spanX, spanY) / 300 || 1;
  // view / backdrop 已經框好範圍,留一點點邊就好;室外沒有底圖,路線要留寬一點
  const pad = (view || backdrop ? 3 : 20) * u;
  const start = route[0];

  return (
    <div className="relative min-h-0 flex-1">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`${minX - pad} ${minY - pad} ${spanX + pad * 2} ${spanY + pad * 2}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="測試路徑與兩趟軌跡"
      >
        {backdrop && (
          <image
            href={backdrop.src}
            x={backdrop.extent.xMin}
            y={-backdrop.extent.yMax}
            width={backdrop.extent.xMax - backdrop.extent.xMin}
            height={backdrop.extent.yMax - backdrop.extent.yMin}
            preserveAspectRatio="none"
            opacity={0.85}
          />
        )}
        {!backdrop && floorPlan && <FloorPlanLayer plan={floorPlan} u={u} />}
        {!backdrop && (
          <polyline
            points={pts(route)}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={2 * u}
            strokeDasharray={`${7 * u} ${6 * u}`}
            strokeLinejoin="round"
          />
        )}
        {/* 先畫啟用前、再畫啟用後,重疊的路段以啟用後為準 */}
        {backdrop
          ? tracks.map((t) =>
              t.points.length > 1 ? (
                <polyline
                  key={t.phase}
                  points={pts(t.points)}
                  fill="none"
                  stroke={PHASE[t.phase].color}
                  strokeWidth={4 * u}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null,
            )
          : runs.map((r) =>
              r.reachedWaypoints > 0 ? (
                <polyline
                  key={r.phase}
                  points={pts([...route.slice(0, r.reachedWaypoints), ...(r.position ? [r.position] : [])])}
                  fill="none"
                  stroke={PHASE[r.phase].color}
                  strokeWidth={4 * u}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null,
            )}
        {/* RU 疊在軌跡上面,路徑經過 RU 時才不會被蓋掉。RU 座標屬於向量平面圖 */}
        {!backdrop &&
          floorPlan?.radios.map((ru) => (
            <g key={ru.id} transform={`translate(${ru.x} ${-ru.y})`}>
              <circle r={5.5 * u} fill={CHART_SURFACE} stroke={RADIO_RING} strokeWidth={1.2 * u} />
              <circle r={2 * u} fill={RADIO_RING} />
            </g>
          ))}
        {!backdrop && start && (
          <circle cx={start.x} cy={-start.y} r={6 * u} fill="#4C8DFF" stroke="#0A172F" strokeWidth={1.5 * u} />
        )}
        {live && (
          <g className="field-live-marker" transform={`translate(${live.x} ${-live.y})`}>
            <circle r={16 * u} fill="#80FFE8" fillOpacity={0.2} />
            {/* 箭頭圖形朝上、SVG rotate 順時針,headingDeg 後端已由 SLAM yaw 換算過(0 = 正北) */}
            <path
              d="M0,-10 L7.5,8 L0,4 L-7.5,8 Z"
              transform={`rotate(${vehicle.headingDeg ?? 0}) scale(${1.2 * u})`}
              fill="#80FFE8"
              stroke="#0A172F"
              strokeWidth={1.2}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/** 平面圖的線:壓暗,路徑與載具才跳得出來 */
const PLAN_LINE = "rgba(255,255,255,0.22)";
const PLAN_OUTLINE = "rgba(255,255,255,0.45)";
const RADIO_RING = "rgba(255,255,255,0.85)";

/** 室內平面圖底圖:外牆、隔間、電梯樓梯(交叉線);RU 由 RouteMap 疊在軌跡上。只畫線不寫字,地圖跨拼接縫 */
function FloorPlanLayer({ plan, u }: { plan: FloorPlan; u: number }) {
  const box = (r: FloorRect) => ({
    x: Math.min(r.x1, r.x2),
    y: -Math.max(r.y1, r.y2),
    width: Math.abs(r.x2 - r.x1),
    height: Math.abs(r.y2 - r.y1),
  });
  return (
    <g fill="none" stroke={PLAN_LINE} strokeWidth={0.8 * u}>
      {plan.rooms.map((r, i) => (
        <rect key={`room-${i}`} {...box(r)} fill="rgba(255,255,255,0.03)" />
      ))}
      {plan.cores.map((r, i) => {
        const b = box(r);
        return (
          <g key={`core-${i}`}>
            <rect {...b} />
            <path
              d={`M${b.x},${b.y} L${b.x + b.width},${b.y + b.height} M${b.x + b.width},${b.y} L${b.x},${b.y + b.height}`}
              strokeWidth={0.5 * u}
            />
          </g>
        );
      })}
      {plan.walls.map((w, i) => (
        <line key={`wall-${i}`} x1={w.x1} y1={-w.y1} x2={w.x2} y2={-w.y2} />
      ))}
      <rect {...box(plan.outline)} stroke={PLAN_OUTLINE} strokeWidth={1.4 * u} />
    </g>
  );
}

/** RU 的圖例(與平面圖上的 RU 同一個樣子) */
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
function MissionProgress({ mission, single = false }: { mission: FieldMission; single?: boolean }) {
  const run = mission.runs[mission.currentRun];
  if (!run) return null;
  const pct = (r: FieldRun) => Math.round(Math.min(Math.max(r.progress, 0), 100));

  if (single) {
    return (
      <div className="field-map-head">
        <span className="flex-none text-sm text-white/60">測試進度</span>
        {/* 固定寬度 + 等寬數字:從 5% 跑到 100% 時,後面的條子才不會跟著左右跳 */}
        <span className="field-progress-pct flex-none text-[2.75rem] font-semibold leading-[1.1] text-white">
          {pct(run)}%
        </span>
        <div className="field-progress-track field-progress-track--single">
          {/* 規範 09:軌道 rgba(255,255,255,0.15) */}
          <div className="field-progress-seg">
            <div className="field-progress-fill" style={{ width: `${pct(run)}%`, background: PROGRESS_COLOR }} />
          </div>
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
 * 「測試數據」卡的兩張圖,室內外共用:上格吞吐量、下格 SINR,都比兩趟的平均。
 * 吞吐量放上面那一格 —— 它才是這張卡的重點,而上面那格比較高(室內 999 : 708)。
 * 放在下面又要更高的話,圖會往上跨過 y = 2160 的拼接縫,y 軸刻度文字就會被電視邊框
 * 切到:兩格的高度是由「間距跨縫」反推的,見 globals.css .field-split。
 */
/** 上格:吞吐量。下行 / 上行一次只畫一個,用 DL / UL 開關切換(名稱自己帶「平均」) */
const RATE_CHARTS: [TrendSpec, TrendSpec] = [
  { label: "平均下行", short: "DL", unit: "kbps", metric: "dlKbps", digits: 0, kind: "rate" },
  { label: "平均上行", short: "UL", unit: "kbps", metric: "ulKbps", digits: 1, kind: "rate" },
];
/** 下格:SINR 不是這次要改善的目標,只當背景資訊看趨勢 —— 不標平均差值、兩趟同權重 */
const SINR_CHART: TrendSpec = {
  label: "平均 SINR",
  unit: "dB",
  metric: "sinrDb",
  digits: 1,
  delta: false,
};

/** 圖表字級與筆畫都以牆面 3× 畫布計:2px 線 = 6、1px 格線 = 3 */
const AXIS_TICK = { fontSize: 72, fill: "rgba(255,255,255,0.6)" };
const AXIS_STROKE = "rgba(255,255,255,0.2)";
const GRID_STROKE = "rgba(255,255,255,0.08)";
/** 圖表底色(小卡疊在大卡上的近似色),端點外圈用它隔開線條 */
const CHART_SURFACE = "#16263A";
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
  xTicks = [0, 50, 100],
  scale = 1,
  unitOverride,
  digitsOverride,
}: {
  spec: TrendSpec;
  series: { phase: OptimizationPhase; samples: FieldSample[] }[];
  bare?: boolean;
  /**
   * 圖跨拼接縫時,避開會落在縫上的刻度。
   * null = 不標橫軸刻度(只留基準線):「走到哪」由測試進度條交代,
   * 圖上再寫一次百分比容易跟進度條混淆,而且第一趟還在跑時那個百分比並不準。
   * 中牆的圖目前都用 null(室內、室外)。
   */
  xTicks?: number[] | null;
  /** 吞吐量:換成所屬小卡選定的單位,y 軸才跟標題一致 */
  scale?: number;
  unitOverride?: string;
  digitsOverride?: number;
}) {
  const shownUnit = unitOverride ?? unit;
  const shownDigits = digitsOverride ?? digits;
  // 依 progress 合併成一列一個 x。兩趟的取樣筆數通常不一樣(例:59 / 57),換算出來的
  // 進度落在不同的 x 上,所以多數列只有其中一趟有值 —— 這種空格是「那一趟在這個進度
  // 沒有取樣點」,不是資料中斷,要靠 connectNulls 跨過去,否則每個點都成為孤立線段
  // (配上 strokeLinecap="round" 會被畫成一顆圓點,整張圖看起來沒有線)。
  // 還沒跑到的進度根本不在 rows 裡,所以線仍然停在目前位置。
  const byProgress = new Map<number, Record<string, number>>();
  series.forEach((s) =>
    s.samples.forEach((pt) => {
      const val = sampleValue(pt, metric);
      if (val === null) return;
      const row = byProgress.get(pt.progress) ?? { progress: pt.progress };
      row[s.phase] = val / scale;
      byProgress.set(pt.progress, row);
    }),
  );
  const rows = [...byProgress.values()].sort((a, b) => a.progress - b.progress);
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
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 24, right: 130, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeWidth={3} vertical={false} />
            <XAxis
              dataKey="progress"
              type="number"
              domain={[0, 100]}
              ticks={xTicks ?? []}
              tickFormatter={(val: number) => `${val}%`}
              tick={xTicks ? AXIS_TICK : false}
              tickLine={false}
              tickMargin={44}
              stroke={AXIS_STROKE}
              strokeWidth={3}
              // 不標刻度時只留基準線,省下的高度讓給圖。但不能收到底:y 軸最低的刻度
              // (例:0)是對齊基準線置中的,字高 72 的一半要有地方放,否則會被吃掉
              height={xTicks ? 130 : 48}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              width={150}
              allowDecimals={shownDigits > 0}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 }}
              contentStyle={TOOLTIP_BOX}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              itemStyle={{ color: "#FFFFFF", padding: "4px 0" }}
              labelFormatter={(val) => `測試進度 ${val}%`}
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
              return end && val !== null ? (
                <ReferenceDot
                  key={`end-${s.phase}`}
                  x={end.progress}
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
 * 兩趟都跑過的路徑進度。後面那趟還在跑就以它為準,不然是拿半趟跟整趟比;
 * 只有一趟有資料(第一趟還在跑)就用那一趟自己的進度。
 */
function sharedProgress(runs: FieldRun[]) {
  const ends = runs
    .map((r) => r.samples.at(-1)?.progress)
    .filter((p): p is number => p !== undefined);
  return ends.length ? Math.min(...ends) : 0;
}

/**
 * QoE xApp 啟用前後:標題列放兩趟的平均與平均差值,底下是兩趟的折線圖。
 * 後面那趟還在跑,平均只取兩趟都跑過的路徑進度,不然是拿半趟跟整趟比。
 * 兩張卡都橫跨 x = 9600 拼接縫 —— 標題列分左右兩段(間距跨縫),x 刻度改 20% 一格避開縫。
 */
function ThroughputCompare({
  runs,
  spec,
  alt,
  series,
  upTo,
  narrow = false,
}: {
  runs: FieldRun[];
  spec: TrendSpec;
  /**
   * 同一張圖的另一個指標(例:下行 / 上行)。一次只顯示一個,名稱下面的開關決定看哪一個,
   * 標題列的數值、單位、平均差值與 y 軸都跟著它 —— 兩者量級差很多(約 100 kbps 對 4000),
   * 疊在一起沒有一條 y 軸讀得準。
   */
  alt?: TrendSpec;
  series: { phase: OptimizationPhase; samples: FieldSample[] }[];
  /** 平均只算到這個路徑進度(見 sharedProgress) */
  upTo: number;
  /** 窄卡(室內效能卡):標題列排成一行,x 刻度回到 50% 一格 */
  narrow?: boolean;
}) {
  const [altOn, setAltOn] = useState(false);
  const active = alt && altOn ? alt : spec;
  const mean = (phase: OptimizationPhase) => {
    const values = (runs.find((r) => r.phase === phase)?.samples ?? [])
      .filter((pt) => pt.progress <= upTo)
      .map((pt) => sampleValue(pt, active.metric))
      .filter((val): val is number => val !== null);
    return values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : null;
  };
  const before = mean("before");
  const after = mean("after");
  const d = before !== null && after !== null ? after - before : null;
  // 吞吐量:用兩趟平均挑一次單位,數值、差值、y 軸都跟著它
  const chosen =
    active.kind === "rate"
      ? pickRateUnit([before, after])
      : { unit: active.unit, scale: 1, digits: active.digits };
  const fmt = (val: number | null) =>
    val === null ? "—" : (val / chosen.scale).toFixed(chosen.digits);
  const dot = (phase: OptimizationPhase) => (
    <span className="inline-block h-4 w-4 self-center rounded-full" style={{ background: PHASE[phase].color }} />
  );
  /* 沒有要改善的指標(delta === false):不標平均差值,兩趟也用同一個字級與亮度 ——
     放大加亮「啟用後」會看起來像是這個指標被優化過。 */
  const plain = active.delta === false;
  // 名稱(不換行)+ 有第二個指標時的 DL / UL 開關,窄版與寬版共用
  const labelBlock = (
    <span className="flex min-w-0 flex-col items-start">
      <span className="whitespace-nowrap text-sm text-white/60">{active.label}</span>
      {alt && (
        <span className="field-metric-switch" role="group" aria-label={`切換 ${spec.label} / ${alt.label}`}>
          {[spec, alt].map((s) => (
            <button
              key={s.metric}
              type="button"
              onClick={() => setAltOn(s === alt)}
              className={s === active ? "is-active" : undefined}
              aria-pressed={s === active}
              title={s.label}
            >
              {s.short ?? s.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
  const beforeCls = plain
    ? "text-[2.25rem] font-semibold leading-[1.1] text-white/75"
    : "text-[2.25rem] leading-[1.1] text-white/65";
  const afterCls = plain
    ? "text-[2.25rem] font-semibold leading-[1.1] text-white/75"
    : "text-[2.75rem] font-semibold leading-[1.1] text-white";
  const delta =
    d === null || active.delta === false ? null : (
      <>
        {d > 0 ? "▲+" : d < 0 ? "▼" : ""}
        {(Math.abs(d) / chosen.scale).toFixed(chosen.digits)}
      </>
    );

  return (
    /* min-w-0:grid 項目預設最小寬度是內容寬度,標題列一長就會把整欄撐出小卡 */
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {narrow ? (
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
        spec={active}
        series={series}
        bare
        // 室內外都不標橫軸(理由見 TrendChart 的 xTicks)
        xTicks={null}
        scale={chosen.scale}
        unitOverride={chosen.unit}
        digitsOverride={chosen.digits}
      />
    </div>
  );
}

// ── 對照表 ───────────────────────────────────────────────────────────

/**
 * 兩趟的名稱與代表色(路線軌跡、進度條、折線、長條、圖例共用)。
 * 顏色用 dataviz 驗證器在深色底(#16263A)上驗過:亮度帶、彩度、色盲 / 一般視覺分辨度、
 * 對比都通過 —— 規範的 #FFC56B / #80FFE8 太亮,當系列色會失去層次。
 */
const PHASE: Record<OptimizationPhase, { label: string; short: string; color: string }> = {
  before: { label: "啟用前", short: "啟用前", color: "#C07F22" },
  after: { label: "啟用後", short: "啟用後", color: "#1C9E88" },
};
/** 室內一整條的測試進度用這個色 —— 跟牆上其他綠色狀態一致,不代表哪一趟 */
const PROGRESS_COLOR = "#1C9E88";
