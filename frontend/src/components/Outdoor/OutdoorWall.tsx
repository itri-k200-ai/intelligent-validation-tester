"use client";
import { ClipboardCheck, Plane, Route, Signal, type LucideIcon } from "lucide-react";
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
import { useOutdoorMission } from "@/hooks/Outdoor/useOutdoorMission";
import type {
  OptimizationPhase,
  OutdoorFlightRun,
  OutdoorMission,
  OutdoorSample,
  UavLinkQuality,
} from "@/types/outdoor";

// ── 室外 UAV 情境中牆 ────────────────────────────────────────────────
// 內容依規劃圖 docs/外部文件/前端UI建議/2026-09-13_智慧網路實驗室_室外UAV情境中牆UI規劃.png。
// 測試流程是無人機沿同一條航線飛兩趟(優化開啟前、開啟後),一次只跑一個測試項目;
// 測項清單在左螢幕,中牆只專注目前這個測試。
// 文字避開電視拼接縫,座標與推算見 globals.css .outdoor-wall:
//
//   ┌ 即時環境影像 ──────────────┐ ┌ 測試狀態總覽 ─────────────────────────── 優化 已開啟 ┐
//   │ [固定攝影機 16:9][機載 16:9]│ │ 測試項目 uav.xxx     Procedure 名稱                    │
//   │ ┌任務執行狀況──────────────┐ │ │ ┌UAV 測試路徑─────────┐ ┌飛行狀態┐ ┌訊號狀態┐          │
//   │ │ SNR  RSSI │ 下行  丟包率  │ │ │ │       路徑圖        │ │ 高度 ╱ │ │ SNR ╱  │          │
//   │ └──────────────────────────┘ │ │ │ 任務進度 64% │ 階段 │ │ 地速 ╱ │ │ 下行 ╱ │          │
//   └──────────────────────────────┘ └────────────────────────────────────────────────────────┘
//
// 資料目前是靜態假資料(見 useOutdoorMission)。
export function OutdoorWall() {
  const { mission } = useOutdoorMission();
  if (!mission) return <p className="p-2 text-sm text-white/40">載入中…</p>;

  const run = mission.runs[mission.currentRun];
  const optimized = run?.phase === "after";
  const allRuns = mission.runs.map((r) => ({ phase: r.phase, samples: r.samples }));
  const currentOnly = run ? [{ phase: run.phase, samples: run.samples }] : [];

  return (
    <div className="outdoor-wall">
      {/* ── 左:即時環境影像 + 任務執行狀況 ── */}
      <section className="dut-wall-band outdoor-card outdoor-card--video">
        <div className="dut-wall-band-title">即時環境影像</div>
        <div className="outdoor-video-row">
          <VideoTile label="室外固定攝影機" src={mission.cameras.fixed} />
          <VideoTile label="無人機機載攝影機" src={mission.cameras.uav} />
        </div>
        <Sub className="outdoor-sub--task" icon={ClipboardCheck} title="任務執行狀況" aside={<PhaseLegend />}>
          <CompareList runs={mission.runs} />
        </Sub>
      </section>

      {/* ── 右:測試狀態總覽 ── */}
      <section className="dut-wall-band outdoor-card">
        <div className="outdoor-card-head">
          <div className="flex items-center justify-between">
            <div className="dut-wall-band-title">測試狀態總覽</div>
            <span
              className={`flex items-center gap-4 rounded-full border px-8 text-base ${
                optimized ? "border-mint/50 text-mint" : "border-white/25 text-white/60"
              }`}
            >
              <span className="text-white/70">優化</span>
              <span
                className={`inline-block h-5 w-5 rounded-full ${optimized ? "bg-mint" : "bg-white/30"}`}
              />
              {optimized ? "已開啟" : "未開啟"}
            </span>
          </div>
          {/* 副標:目前的測試項目。代碼、名稱分放兩台電視,中間的間距跨 x = 5760 */}
          <div className="outdoor-subtitle text-sm">
            <span className="flex min-w-0 items-baseline gap-6">
              <span className="flex-none text-white/55">測試項目</span>
              <span className="min-w-0 truncate font-mono">{mission.testcase.code}</span>
            </span>
            <span className="min-w-0 truncate text-white/60">{mission.testcase.procedure}</span>
          </div>
        </div>

        <div className="outdoor-status-body">
          <Sub icon={Route} title="UAV 測試路徑" aside={<PhaseLegend />}>
            <RouteMap mission={mission} />
            <MissionProgress mission={mission} />
          </Sub>

          <Sub icon={Plane} title="飛行狀態">
            {/* 上下兩張圖的間距跨 y = 2160 */}
            <div className="outdoor-split">
              <TrendChart label="相對高度" unit="m" metric="altitudeM" digits={1} series={currentOnly} />
              <TrendChart label="地速" unit="m/s" metric="groundSpeedMps" digits={1} series={currentOnly} />
            </div>
          </Sub>

          <Sub icon={Signal} title="訊號狀態">
            <div className="outdoor-split">
              <div className="flex min-h-0 flex-col">
                {/* 圖例放這一行:小卡標題列寬度不夠,放在那裡會被截掉 */}
                <span className="flex flex-none justify-end text-sm text-white/70">
                  <PhaseLegend />
                </span>
                <TrendChart label="SNR" unit="dB" metric="snrDb" digits={1} series={allRuns} />
              </div>
              <TrendChart label="下行速率" unit="Mbps" metric="dlMbps" digits={0} series={allRuns} />
            </div>
          </Sub>
        </div>
      </section>
    </div>
  );
}

// ── 共用 ─────────────────────────────────────────────────────────────

/** 一格影像(16:9),名稱疊在左下 */
function VideoTile({ label, src }: { label: string; src: string | null }) {
  return (
    <div className="outdoor-video">
      <LiveVideo src={src} />
      <span className="outdoor-video-label">{label}</span>
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
    <section className={`outdoor-sub ${className}`}>
      {/* 刻意不用 <header>:globals.css 的 `html.wall-mode header` 是給整站 Header 的,
          會把高度撐成兩倍 */}
      <div className="outdoor-sub-head">
        <Icon className="h-10 w-10 flex-none text-teal" strokeWidth={1.75} />
        <span className="flex-none text-[2.5rem] font-semibold leading-tight">{title}</span>
        {aside && <span className="ml-auto min-w-0 truncate text-sm text-white/60">{aside}</span>}
      </div>
      <div className="outdoor-sub-body">{children}</div>
    </section>
  );
}

/** 兩趟的圖例:色條 + 名稱(文字不上系列色) */
function PhaseLegend({ phases = ["before", "after"] }: { phases?: OptimizationPhase[] }) {
  return (
    <span className="flex items-center gap-8">
      {phases.map((p) => (
        <span key={p} className="flex items-center gap-3">
          <span className="inline-block h-[6px] w-12 rounded-full" style={{ background: PHASE[p].color }} />
          {PHASE[p].short}
        </span>
      ))}
    </span>
  );
}

// ── 任務執行狀況:優化開啟前 → 開啟後 ─────────────────────────────────

type CompareRow = {
  key: keyof Pick<UavLinkQuality, "snrDb" | "rssiDbm" | "dlMbps" | "packetLossPct">;
  label: string;
  unit: string;
  digits: number;
  /** 數值越大越好還是越小越好 —— 決定變化量上色 */
  better: "higher" | "lower";
};

/** 任務執行狀況只放 4 項:左欄訊號、右欄傳輸(欄距跨 x = 1920)。要換指標改這裡。 */
const COMPARE_COLUMNS: CompareRow[][] = [
  [
    { key: "snrDb", label: "SNR", unit: "dB", digits: 1, better: "higher" },
    { key: "rssiDbm", label: "RSSI", unit: "dBm", digits: 1, better: "higher" },
  ],
  [
    { key: "dlMbps", label: "下行速率", unit: "Mbps", digits: 0, better: "higher" },
    { key: "packetLossPct", label: "丟包率", unit: "%", digits: 2, better: "lower" },
  ],
];

function CompareList({ runs }: { runs: OutdoorFlightRun[] }) {
  const before = runs.find((r) => r.phase === "before")?.link ?? null;
  const after = runs.find((r) => r.phase === "after")?.link ?? null;
  return (
    <div className="outdoor-compare-list min-h-0 flex-1">
      {COMPARE_COLUMNS.map((rows) => (
        <div key={rows[0].key} className="flex min-h-0 min-w-0 flex-col divide-y divide-white/10">
          {rows.map((row) => (
            <CompareRowView key={row.key} row={row} before={before} after={after} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** 一列:指標 | 開啟前 → 開啟後 | 變化量 */
function CompareRowView({
  row,
  before,
  after,
}: {
  row: CompareRow;
  before: UavLinkQuality | null;
  after: UavLinkQuality | null;
}) {
  const b = before?.[row.key] ?? null;
  const a = after?.[row.key] ?? null;
  const d = a !== null && b !== null ? a - b : null;
  const improved = d !== null && (row.better === "higher" ? d > 0 : d < 0);
  const deltaTone = d === null || d === 0 ? "text-white/40" : improved ? "text-mint" : "text-danger";
  return (
    <div className="outdoor-compare-row min-h-0 flex-1">
      <span className="truncate whitespace-nowrap text-sm text-white/60">
        {row.label}
        {row.unit && <span className="ml-3 text-white/35">{row.unit}</span>}
      </span>
      <span className="text-right text-[2rem] tabular-nums text-white/50">
        {b === null ? "—" : b.toFixed(row.digits)}
      </span>
      <span className="text-sm text-white/35">→</span>
      <span className="text-right text-[2.75rem] font-semibold leading-[1.1] tabular-nums text-mint">
        {a === null ? "—" : a.toFixed(row.digits)}
      </span>
      <span className={`text-right text-sm font-semibold tabular-nums ${deltaTone}`}>
        {d === null ? "—" : `${d > 0 ? "+" : ""}${d.toFixed(row.digits)}`}
      </span>
    </div>
  );
}

// ── UAV 測試路徑 ─────────────────────────────────────────────────────

/** 同一條航線上疊出兩趟軌跡(開啟前 / 開啟後)與目前無人機位置 */
function RouteMap({ mission }: { mission: OutdoorMission }) {
  const { route, runs, flight } = mission;
  const live = runs[mission.currentRun]?.position ?? null;

  // 航點是 x 向東、y 向北(公尺);SVG 的 y 向下,畫的時候把 y 取負。
  const xs = [...route.map((p) => p.x), ...(live ? [live.x] : [])];
  const ys = [...route.map((p) => -p.y), ...(live ? [-live.y] : [])];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX;
  const spanY = Math.max(...ys) - minY;
  // u = 一個視覺單位:線寬、點大小都乘它,航線範圍不管幾公尺比例都一致
  const u = Math.max(spanX, spanY, 50) / 300;
  const pad = 20 * u;
  const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x},${-p.y}`).join(" ");
  const home = route[0];

  return (
    <div className="relative min-h-0 flex-1">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`${minX - pad} ${minY - pad} ${spanX + pad * 2} ${spanY + pad * 2}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="UAV 航線與兩趟飛行軌跡"
      >
        <polyline
          points={pts(route)}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2 * u}
          strokeDasharray={`${7 * u} ${6 * u}`}
          strokeLinejoin="round"
        />
        {/* 先畫開啟前、再畫開啟後,重疊的航段以開啟後為準 */}
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
        {home && (
          <circle cx={home.x} cy={-home.y} r={6 * u} fill="#4C8DFF" stroke="#0A172F" strokeWidth={1.5 * u} />
        )}
        {live && (
          <g transform={`translate(${live.x} ${-live.y})`}>
            <circle r={16 * u} fill="#80FFE8" fillOpacity={0.2} />
            <path
              d="M0,-10 L7.5,8 L0,4 L-7.5,8 Z"
              transform={`rotate(${flight.headingDeg}) scale(${1.2 * u})`}
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

/** 路線圖下方:目前這趟的任務進度(左)與階段(右),欄距跨 x = 5760 */
function MissionProgress({ mission }: { mission: OutdoorMission }) {
  const run = mission.runs[mission.currentRun];
  if (!run) return null;
  const pct = Math.round(Math.min(Math.max(run.progress, 0), 100));
  const phase = PHASE[run.phase];
  return (
    <div className="outdoor-map-foot">
      <div className="flex min-w-0 items-center gap-8">
        <span className="flex-none text-sm text-white/60">任務進度</span>
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

const RUN_STATUS: Record<OutdoorFlightRun["status"], string> = {
  pending: "待命",
  running: "進行中",
  finished: "已完成",
  error: "錯誤",
};

// ── 折線圖(飛行狀態 / 訊號狀態)──────────────────────────────────────

type TrendMetric = Exclude<keyof OutdoorSample, "progress">;

/** 圖表字級與筆畫都以牆面 3× 畫布計:2px 線 = 6、1px 格線 = 3 */
const AXIS_TICK = { fontSize: 72, fill: "rgba(255,255,255,0.6)" };
/** 圖表底色(小卡疊在大卡上的近似色),端點外圈用它隔開線條 */
const CHART_SURFACE = "#16263A";

/**
 * 一張折線圖:x 為航線進度(%),一條線一趟飛行。
 * 標題列顯示目前這趟的最新值。多條線時圖例由所屬小卡放一次(單條線由標題說明)。
 */
function TrendChart({
  label,
  unit,
  metric,
  digits,
  series,
}: {
  label: string;
  unit: string;
  metric: TrendMetric;
  digits: number;
  series: { phase: OptimizationPhase; samples: OutdoorSample[] }[];
}) {
  // 依 progress 合併成一列一個 x;沒飛到的進度留空,線自然停在目前位置
  const byProgress = new Map<number, Record<string, number>>();
  series.forEach((s) =>
    s.samples.forEach((pt) => {
      const row = byProgress.get(pt.progress) ?? { progress: pt.progress };
      row[s.phase] = pt[metric];
      byProgress.set(pt.progress, row);
    }),
  );
  const rows = [...byProgress.values()].sort((a, b) => a.progress - b.progress);
  const latest = series[series.length - 1]?.samples.at(-1);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-baseline gap-5">
        <span className="text-sm text-white/60">{label}</span>
        <span className="text-[2.75rem] font-semibold leading-[1.1] text-white">
          {latest ? latest[metric].toFixed(digits) : "—"}
        </span>
        <span className="text-sm text-white/50">{unit}</span>
      </div>
      <div className="relative mt-4 min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 24, right: 130, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeWidth={3} vertical={false} />
            <XAxis
              dataKey="progress"
              type="number"
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={AXIS_TICK}
              tickLine={false}
              tickMargin={44}
              stroke="rgba(255,255,255,0.2)"
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
              contentStyle={{
                background: "rgba(10,23,47,0.94)",
                border: "3px solid rgba(255,255,255,0.2)",
                borderRadius: 16,
                padding: "16px 24px",
              }}
              labelStyle={{ color: "rgba(255,255,255,0.7)", fontSize: 64 }}
              itemStyle={{ color: "#FFFFFF", fontSize: 64, padding: "4px 0" }}
              labelFormatter={(v) => `航線進度 ${v}%`}
              formatter={(v, name) => [
                `${Number(v).toFixed(digits)} ${unit}`,
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
              return end ? (
                <ReferenceDot
                  key={`end-${s.phase}`}
                  x={end.progress}
                  y={end[metric]}
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

// ── 對照表 ───────────────────────────────────────────────────────────

/**
 * 兩趟的名稱與代表色(路線軌跡、進度條、折線、圖例共用)。
 * 顏色用 dataviz 驗證器在深色底(#16263A)上驗過:亮度帶、彩度、色盲 / 一般視覺分辨度、
 * 對比都通過 —— 規範的 #FFC56B / #80FFE8 太亮,當系列色會失去層次。
 */
const PHASE: Record<OptimizationPhase, { label: string; short: string; color: string }> = {
  before: { label: "優化開啟前", short: "開啟前", color: "#C07F22" },
  after: { label: "優化開啟後", short: "開啟後", color: "#1C9E88" },
};
