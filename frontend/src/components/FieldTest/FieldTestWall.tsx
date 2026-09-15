"use client";
import { Bot, Plane, Route, Signal, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
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
import {
  FIELD_SCENARIOS,
  type FieldScenario,
  type TrendMetric,
  type TrendSpec,
} from "@/config/fieldScenarios";
import { useFieldTestMission } from "@/hooks/FieldTest/useFieldTestMission";
import type {
  FieldMission,
  FieldRun,
  FieldSample,
  FieldScenarioId,
  FieldVehicleStatus,
  OptimizationPhase,
} from "@/types/fieldTest";

// ── 場域測試中牆(室外 UAV / 室內 AMR)──────────────────────────────────
// 內容依規劃圖 docs/外部文件/前端UI建議/2026-09-13_智慧網路實驗室_室外UAV情境中牆UI規劃.png。
// 測試流程是載具沿同一條路徑跑兩趟(優化前、優化後),一次只跑一個測試項目;
// 測項清單在左螢幕,中牆只專注目前這個測試。兩種版面(見 config/fieldScenarios.ts)
// 共用下面的小卡、路徑圖、折線圖。文字避開電視拼接縫,座標與推算見 globals.css .field-wall。
//
// live-results(室外):左即時、右結果
//   ┌ 即時狀態 ───────── 優化 已開啟 ┐ ┌ 測試狀態總覽 │ 測試項目 │ 測試環境 │ 優化前 優化後 ┐
//   │ [固定攝影機 16:9][載具 16:9]   │ │ ┌測試路徑──────────┐ ┌QoE 優化開啟前後比較────────┐ │
//   │ ┌飛行狀態──────┐ ┌UAV 通訊品質┐│ │ │ 路徑圖(兩趟)    │ │ 下行 最低值 25 → 128       │ │
//   │ │ 高度 地速 …   │ │ SNR RSSI …││ │ │ 測試進度 │ 階段  │ │ 上行 ╱╲╱                  │ │
//   └──────────────────────────────────┘ └──────────────────────────────────────────────────────┘
//
// camera-grid(室內):同樣左即時、右結果,但 4 路影像放不進 1/3 寬,所以左右各半
//   ┌ 即時狀態 ─────────────────────── 優化 已開啟 ┐ ┌ 測試狀態總覽 │ 測試項目 │ 測試環境 ┐
//   │ [攝影機 1][攝影機 2] ┌行駛狀態────┐        │ │ ┌AMR 測試路徑────────┐ ┌IM 優化─┐ │
//   │ [攝影機 3][AMR 車載] └AMR 通訊品質┘        │ │ └路徑圖 / 測試進度───┘ └SNR 下行┘ │
//   └──────────────────────────────────────────────┘ └──────────────────────────────────────┘
//
// 資料目前是靜態假資料(見 useFieldTestMission)。

/** 載具狀態小卡的圖示 */
const VEHICLE_ICON: Record<FieldScenarioId, LucideIcon> = { outdoor: Plane, indoor: Bot };

export function FieldTestWall({ scenario }: { scenario: FieldScenarioId }) {
  const sc = FIELD_SCENARIOS[scenario];
  const { mission } = useFieldTestMission(scenario);
  if (!mission) return <p className="p-2 text-sm text-white/40">載入中…</p>;

  return sc.layout === "live-results" ? (
    <LiveResultsLayout scenario={scenario} sc={sc} mission={mission} />
  ) : (
    <CameraGridLayout scenario={scenario} sc={sc} mission={mission} />
  );
}

// ── 版面:左即時、右結果(室外)─────────────────────────────────────────

function LiveResultsLayout({
  scenario,
  sc,
  mission,
}: {
  scenario: FieldScenarioId;
  sc: Extract<FieldScenario, { layout: "live-results" }>;
  mission: FieldMission;
}) {
  const run = mission.runs[mission.currentRun];
  const allRuns = mission.runs.map((r) => ({ phase: r.phase, samples: r.samples }));

  return (
    <div className="field-wall">
      {/* ── 左:即時狀態 ── */}
      <section className="dut-wall-band field-card field-card--video">
        <div className="flex items-center justify-between">
          <div className="dut-wall-band-title">即時狀態</div>
          <OptimizationBadge optimized={run?.phase === "after"} />
        </div>
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
            vehicle={mission.vehicle}
          />
          <SignalSub className="field-sub--lower" title={sc.live.signalTitle} run={run} />
        </div>
      </section>

      {/* ── 右:測試狀態總覽(路徑與進度不是「結果」,比較圖也要跑完才算結果,所以不叫測試結果)── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head">
          <HeadRow
            title="測試狀態總覽"
            mission={mission}
            right={
              /* 右邊所有圖共用這份圖例 */
              <span className="justify-self-end text-sm text-white/70">
                <PhaseLegend />
              </span>
            }
          />
        </div>

        <div className="field-status-body field-status-body--results">
          <Sub icon={Route} title={sc.routeTitle}>
            <RouteMap mission={mission} />
            <MissionProgress mission={mission} />
          </Sub>

          {/* 室外情境要呈現的是:在具備干擾的環境中,UAV 移動時傳輸穩不穩定。
              干擾範圍會隨環境變動,畫面上不標固定的干擾區,只呈現兩趟的吞吐量起伏與最低值。
              場域內只觀察這台 UAV;上下兩張圖的間距跨 y = 2160 */}
          <Sub icon={Signal} title="QoE 優化開啟前後比較">
            <div className="field-split">
              <ThroughputCompare runs={mission.runs} spec={THROUGHPUT_CHARTS[0]} series={allRuns} />
              <ThroughputCompare runs={mission.runs} spec={THROUGHPUT_CHARTS[1]} series={allRuns} />
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
}: {
  scenario: FieldScenarioId;
  sc: Extract<FieldScenario, { layout: "camera-grid" }>;
  mission: FieldMission;
}) {
  const run = mission.runs[mission.currentRun];
  const allRuns = mission.runs.map((r) => ({ phase: r.phase, samples: r.samples }));

  return (
    <div className="field-wall field-wall--half">
      {/* ── 左:即時狀態(2×2 影像 + 即時數值)── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head">
          <div className="flex items-center justify-between">
            <div className="dut-wall-band-title">即時狀態</div>
            <OptimizationBadge optimized={run?.phase === "after"} />
          </div>
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
            <VehicleSub scenario={scenario} title={sc.live.vehicleTitle} vehicle={mission.vehicle} />
            <SignalSub className="field-sub--lower" title={sc.live.signalTitle} run={run} />
          </div>
        </div>
      </section>

      {/* ── 右:測試狀態總覽 ── */}
      <section className="dut-wall-band field-card">
        <div className="field-card-head">
          <HeadRow title="測試狀態總覽" mission={mission} />
        </div>

        <div className="field-status-body">
          <Sub icon={Route} title={sc.routeTitle} aside={<PhaseLegend />}>
            <RouteMap mission={mission} />
            <MissionProgress mission={mission} />
          </Sub>

          <Sub icon={Signal} title="IM 優化開啟前後比較">
            <div className="field-split">
              <div className="flex min-h-0 flex-col">
                {/* 圖例放這一行:小卡標題列寬度不夠,放在那裡會被截掉 */}
                <span className="flex flex-none justify-end text-sm text-white/70">
                  <PhaseLegend />
                </span>
                <TrendChart spec={SIGNAL_CHARTS[0]} series={allRuns} />
              </div>
              <TrendChart spec={SIGNAL_CHARTS[1]} series={allRuns} />
            </div>
          </Sub>
        </div>
      </section>
    </div>
  );
}

// ── 共用 ─────────────────────────────────────────────────────────────

/**
 * 右卡標題列:標題 | 測試項目 | 測試環境 | right(可省),各占一台電視寬(間距跨拼接縫)。
 * 測試項目放在同一行,底下的小卡才能往上長。
 */
function HeadRow({ title, mission, right }: { title: string; mission: FieldMission; right?: ReactNode }) {
  return (
    <div className="field-head-row">
      <div className="dut-wall-band-title">{title}</div>
      <span className="flex min-w-0 items-baseline gap-6">
        <span className="flex-none text-sm text-white/55">測試項目</span>
        <span className="min-w-0 truncate text-base font-semibold">{mission.testcase.name}</span>
      </span>
      <span className="flex min-w-0 items-baseline gap-6">
        <span className="flex-none text-sm text-white/55">測試環境</span>
        <span className="min-w-0 truncate text-base">{mission.testcase.environment}</span>
      </span>
      {right}
    </div>
  );
}

function OptimizationBadge({ optimized, className = "" }: { optimized: boolean; className?: string }) {
  return (
    <span
      className={`flex items-center gap-4 rounded-full border px-8 text-base ${
        optimized ? "border-mint/50 text-mint" : "border-white/25 text-white/60"
      } ${className}`}
    >
      <span className="text-white/70">優化</span>
      <span className={`inline-block h-5 w-5 rounded-full ${optimized ? "bg-mint" : "bg-white/30"}`} />
      {optimized ? "已開啟" : "未開啟"}
    </span>
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

/** 兩趟的圖例:色條 + 名稱(文字不上系列色) */
function PhaseLegend() {
  return (
    <span className="flex items-center gap-8">
      {(Object.keys(PHASE) as OptimizationPhase[]).map((p) => (
        <span key={p} className="flex items-center gap-3">
          <span className="inline-block h-[6px] w-12 rounded-full" style={{ background: PHASE[p].color }} />
          {PHASE[p].short}
        </span>
      ))}
    </span>
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

/** 3 欄 × 2 列的即時數值:標籤(含單位)在上、數值在下 */
function MetricGrid({ items }: { items: Reading[] }) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 grid-rows-2 gap-x-4">
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

/** 載具即時數值:室外 UAV 與室內 AMR 各看各的參數,都是 3 欄 × 2 列 */
function vehicleReadings(scenario: FieldScenarioId, v: FieldVehicleStatus): Reading[] {
  const battery: Reading = {
    label: "電量",
    unit: "%",
    value: v.batteryPct,
    tone: v.batteryPct < 30 ? "text-danger" : undefined,
  };
  // 模式字串較長,字級小一階才放得進欄寬
  const mode: Reading = { label: "模式", value: v.mode, tone: "text-warning", size: "text-[2rem]" };
  if (scenario === "indoor") {
    return [
      { label: "速度", unit: "m/s", value: v.speedMps.toFixed(2) },
      { label: "航向", unit: "°", value: v.headingDeg.toFixed(0) },
      battery,
      { label: "里程", unit: "m", value: v.odometerM?.toFixed(1) ?? null },
      { label: "障礙距離", unit: "m", value: v.obstacleM?.toFixed(1) ?? null },
      mode,
    ];
  }
  return [
    // 欄寬窄,「相對高度 m」會被截斷
    { label: "高度", unit: "m", value: v.altitudeM?.toFixed(1) ?? null },
    { label: "地速", unit: "m/s", value: v.speedMps.toFixed(1) },
    { label: "垂直", unit: "m/s", value: v.verticalSpeedMps?.toFixed(1) ?? null },
    battery,
    { label: "衛星數", value: v.satellites ?? null },
    mode,
  ];
}

/** 飛行狀態 / 行駛狀態 */
function VehicleSub({
  scenario,
  title,
  vehicle,
  className,
}: {
  scenario: FieldScenarioId;
  title: string;
  vehicle: FieldVehicleStatus;
  className?: string;
}) {
  return (
    <Sub className={className} icon={VEHICLE_ICON[scenario]} title={title}>
      <MetricGrid items={vehicleReadings(scenario, vehicle)} />
    </Sub>
  );
}

/** UAV / AMR 通訊品質:目前這趟的鏈路數值 */
function SignalSub({ title, run, className }: { title: string; run: FieldRun | undefined; className?: string }) {
  const link = run?.link ?? null;
  return (
    <Sub
      className={className}
      icon={Signal}
      title={title}
      aside={run ? `目前:${PHASE[run.phase].short}` : undefined}
    >
      <MetricGrid
        items={[
          { label: "SNR", unit: "dB", value: link?.snrDb.toFixed(1) ?? null },
          { label: "RSSI", unit: "dBm", value: link?.rssiDbm.toFixed(1) ?? null },
          { label: "RSRQ", unit: "dB", value: link?.rsrqDb.toFixed(1) ?? null },
          { label: "上行", unit: "Mbps", value: link?.ulMbps?.toFixed(1) ?? null },
          { label: "下行", unit: "Mbps", value: link?.dlMbps?.toFixed(0) ?? null },
          { label: "丟包", unit: "%", value: link?.packetLossPct?.toFixed(2) ?? null },
        ]}
      />
    </Sub>
  );
}

// ── 測試路徑 ─────────────────────────────────────────────────────────

/** 同一條路徑上疊出兩趟軌跡(優化前 / 優化後)與載具目前位置 */
function RouteMap({ mission }: { mission: FieldMission }) {
  const { route, runs, vehicle } = mission;
  const live = runs[mission.currentRun]?.position ?? null;

  // 路徑點是 x 向東、y 向北(公尺);SVG 的 y 向下,畫的時候把 y 取負。
  const xs = [...route.map((p) => p.x), ...(live ? [live.x] : [])];
  const ys = [...route.map((p) => -p.y), ...(live ? [-live.y] : [])];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  // u = 一個視覺單位:線寬、點大小都乘它,路徑範圍不管幾公尺比例都一致
  const u = Math.max(spanX, spanY) / 300 || 1;
  const pad = 20 * u;
  const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x},${-p.y}`).join(" ");
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
        <polyline
          points={pts(route)}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2 * u}
          strokeDasharray={`${7 * u} ${6 * u}`}
          strokeLinejoin="round"
        />
        {/* 先畫優化前、再畫優化後,重疊的路段以優化後為準 */}
        {runs.map((r) =>
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
        {start && (
          <circle cx={start.x} cy={-start.y} r={6 * u} fill="#4C8DFF" stroke="#0A172F" strokeWidth={1.5 * u} />
        )}
        {live && (
          <g transform={`translate(${live.x} ${-live.y})`}>
            <circle r={16 * u} fill="#80FFE8" fillOpacity={0.2} />
            <path
              d="M0,-10 L7.5,8 L0,4 L-7.5,8 Z"
              transform={`rotate(${vehicle.headingDeg}) scale(${1.2 * u})`}
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

/** 路徑圖下方:目前這趟的測試進度(左)與階段(右),欄距跨拼接縫(見 globals.css .field-map-foot) */
function MissionProgress({ mission }: { mission: FieldMission }) {
  const run = mission.runs[mission.currentRun];
  if (!run) return null;
  const pct = Math.round(Math.min(Math.max(run.progress, 0), 100));
  const phase = PHASE[run.phase];
  return (
    <div className="field-map-foot">
      <div className="flex min-w-0 items-center gap-8">
        <span className="flex-none text-sm text-white/60">測試進度</span>
        {/* 規範 09:軌道 rgba(255,255,255,0.15) */}
        <div className="h-4 min-w-0 flex-1 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: phase.color }} />
        </div>
        <span className="flex-none text-[2.75rem] font-semibold leading-[1.1] text-white">{pct}%</span>
      </div>
      <div className="flex min-w-0 items-center gap-6">
        <span className="flex-none text-sm text-white/60">目前階段</span>
        <span className="inline-block h-5 w-5 flex-none rounded-full" style={{ background: phase.color }} />
        <span className="flex-none text-[2.5rem] font-semibold leading-tight">{phase.label}</span>
        <span className="flex-none text-sm text-white/60">{RUN_STATUS[run.status]}</span>
      </div>
    </div>
  );
}

const RUN_STATUS: Record<FieldRun["status"], string> = {
  pending: "待命",
  running: "進行中",
  finished: "已完成",
  error: "錯誤",
};

// ── 折線圖 ───────────────────────────────────────────────────────────

/** IM 優化開啟前後比較的兩張圖(室內) */
const SIGNAL_CHARTS: [TrendSpec, TrendSpec] = [
  { label: "SNR", unit: "dB", metric: "snrDb", digits: 1 },
  { label: "下行吞吐量", unit: "Mbps", metric: "dlMbps", digits: 0 },
];

/** QoE 優化開啟前後比較的兩張圖 */
const THROUGHPUT_CHARTS: [TrendSpec, TrendSpec] = [
  { label: "下行吞吐量", unit: "Mbps", metric: "dlMbps", digits: 0 },
  { label: "上行吞吐量", unit: "Mbps", metric: "ulMbps", digits: 1 },
];

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
}: {
  spec: TrendSpec;
  series: { phase: OptimizationPhase; samples: FieldSample[] }[];
  bare?: boolean;
  /** 圖跨拼接縫時,避開會落在縫上的刻度 */
  xTicks?: number[];
}) {
  // 依 progress 合併成一列一個 x;沒跑到的進度留空,線自然停在目前位置
  const byProgress = new Map<number, Record<string, number>>();
  series.forEach((s) =>
    s.samples.forEach((pt) => {
      const val = sampleValue(pt, metric);
      if (val === null) return;
      const row = byProgress.get(pt.progress) ?? { progress: pt.progress };
      row[s.phase] = val;
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
            {latest === null ? "—" : latest.toFixed(digits)}
          </span>
          <span className="text-sm text-white/50">{unit}</span>
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
              ticks={xTicks}
              tickFormatter={(val: number) => `${val}%`}
              tick={AXIS_TICK}
              tickLine={false}
              tickMargin={44}
              stroke={AXIS_STROKE}
              strokeWidth={3}
              height={130}
            />
            <YAxis
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              tickCount={4}
              width={150}
              allowDecimals={false}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 }}
              contentStyle={TOOLTIP_BOX}
              labelStyle={{ color: "rgba(255,255,255,0.7)" }}
              itemStyle={{ color: "#FFFFFF", padding: "4px 0" }}
              labelFormatter={(val) => `測試進度 ${val}%`}
              formatter={(val, name) => [
                `${Number(val).toFixed(digits)} ${unit}`,
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
                connectNulls={false}
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
                  y={val}
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
 * QoE 優化開啟前後比較:標題列放兩趟的最低值與變化量,底下是兩趟的折線圖。
 * 移動中受干擾最直接的反應是掉速,最低值不需要事先假設干擾在哪一段。
 * 這張圖橫跨 x = 9600 拼接縫 —— 標題列分左右兩段(間距跨縫),x 刻度改 20% 一格避開縫。
 */
function ThroughputCompare({
  runs,
  spec,
  series,
}: {
  runs: FieldRun[];
  spec: TrendSpec;
  series: { phase: OptimizationPhase; samples: FieldSample[] }[];
}) {
  const lowest = (phase: OptimizationPhase) => {
    const values = (runs.find((r) => r.phase === phase)?.samples ?? [])
      .map((pt) => sampleValue(pt, spec.metric))
      .filter((val): val is number => val !== null);
    return values.length ? Math.min(...values) : null;
  };
  const before = lowest("before");
  const after = lowest("after");
  const d = before !== null && after !== null ? after - before : null;
  const fmt = (val: number | null) => (val === null ? "—" : val.toFixed(spec.digits));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 左段:名稱 + 兩個數值 + 單位;兩段都不能超過各自欄寬,否則會壓到 x = 9600 */}
      <div className="field-compare-head mb-4 flex-none">
        <div className="flex min-w-0 items-baseline gap-6 whitespace-nowrap">
          <span className="text-sm text-white/60">{spec.label}</span>
          <span className="flex items-baseline gap-3">
            <span className="inline-block h-4 w-4 self-center rounded-full" style={{ background: PHASE.before.color }} />
            <span className="text-[2.25rem] leading-[1.1] text-white/65">{fmt(before)}</span>
          </span>
          <span className="text-sm text-white/35">→</span>
          <span className="flex items-baseline gap-3">
            <span className="inline-block h-4 w-4 self-center rounded-full" style={{ background: PHASE.after.color }} />
            <span className="text-[2.75rem] font-semibold leading-[1.1] text-white">{fmt(after)}</span>
          </span>
          <span className="text-sm text-white/50">{spec.unit}</span>
        </div>
        <div className="flex min-w-0 items-baseline justify-end gap-6 whitespace-nowrap">
          <span className="text-sm text-white/50">最低值</span>
          {d !== null && (
            <span className={`text-base font-semibold ${d >= 0 ? "text-mint" : "text-danger"}`}>
              {d > 0 ? "▲+" : d < 0 ? "▼" : ""}
              {d.toFixed(spec.digits)}
            </span>
          )}
        </div>
      </div>
      <TrendChart spec={spec} series={series} bare xTicks={[0, 20, 40, 60, 80, 100]} />
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
  before: { label: "優化前", short: "優化前", color: "#C07F22" },
  after: { label: "優化後", short: "優化後", color: "#1C9E88" },
};
