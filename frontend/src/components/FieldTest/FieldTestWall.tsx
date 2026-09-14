"use client";
import { Bot, Plane, Route, Signal, Users, type LucideIcon } from "lucide-react";
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
import { FIELD_SCENARIOS, type TrendMetric, type TrendSpec } from "@/config/fieldScenarios";
import { useFieldTestMission } from "@/hooks/FieldTest/useFieldTestMission";
import type {
  FieldMission,
  FieldRun,
  FieldSample,
  FieldScenarioId,
  OptimizationPhase,
} from "@/types/fieldTest";

// ── 場域測試中牆(室外 UAV / 室內 AMR 共用)──────────────────────────────
// 內容依規劃圖 docs/外部文件/前端UI建議/2026-09-13_智慧網路實驗室_室外UAV情境中牆UI規劃.png。
// 測試流程是載具沿同一條路徑跑兩趟(優化開啟前、開啟後),一次只跑一個測試項目;
// 測項清單在左螢幕,中牆只專注目前這個測試。兩個情境的差別見 config/fieldScenarios.ts。
// 文字避開電視拼接縫,座標與推算見 globals.css .field-wall。
// 室外的版面如下;室內(throughputOnRight)左邊改 4 路影像,右邊中間上半 UE 吞吐量、下半行駛狀態:
//
//   ┌ 即時環境影像 ──────────────┐ ┌ 測試狀態總覽 │ 測試項目 xxx.code │ Procedure │ 優化 已開啟 ┐
//   │ [固定攝影機 16:9][載具 16:9]│ │                                                        │
//   │ ┌場域 UE 吞吐量(10 台)────┐ │ │ ┌測試路徑─────────────┐ ┌移動狀態┐ ┌訊號狀態┐          │
//   │ │ ╱╲╱ 各 UE(灰)+ 平均    │ │ │ │       路徑圖        │ │ 圖 1 ╱ │ │ SNR ╱  │          │
//   │ └──────────────────────────┘ │ │ │ 任務進度 64% │ 階段 │ │ 圖 2 ╱ │ │ 下行 ╱ │          │
//   └──────────────────────────────┘ └────────────────────────────────────────────────────────┘
//
// 資料目前是靜態假資料(見 useFieldTestMission)。

/** 移動狀態小卡的圖示 */
const MOTION_ICON: Record<FieldScenarioId, LucideIcon> = { outdoor: Plane, indoor: Bot };

export function FieldTestWall({ scenario }: { scenario: FieldScenarioId }) {
  const sc = FIELD_SCENARIOS[scenario];
  const { mission } = useFieldTestMission(scenario);
  if (!mission) return <p className="p-2 text-sm text-white/40">載入中…</p>;

  const run = mission.runs[mission.currentRun];
  const optimized = run?.phase === "after";
  const allRuns = mission.runs.map((r) => ({ phase: r.phase, samples: r.samples }));
  const currentOnly = run ? [{ phase: run.phase, samples: run.samples }] : [];

  return (
    <div className="field-wall">
      {/* ── 左:即時環境影像(UE 吞吐量不在右邊時,放在影像下方)── */}
      <section className={`dut-wall-band field-card ${sc.throughputOnRight ? "field-card--cameras" : "field-card--video"}`}>
        <div className="dut-wall-band-title">即時環境影像</div>
        <div className={sc.throughputOnRight ? "field-video-grid" : "field-video-row"}>
          {sc.cameras.map((label, i) => (
            <VideoTile key={label} label={label} src={mission.cameras[i] ?? null} />
          ))}
        </div>
        {!sc.throughputOnRight && run && (
          <Sub className="field-sub--throughput" icon={Users} title="場域 UE 吞吐量" aside={`${run.ueThroughput.length} 台 UE`}>
            {/* 這張圖橫跨 x = 1920 拼接縫:刻度不放 50%(會落在縫上) */}
            <UeThroughputChart run={run} xTicks={[0, 20, 40, 60, 80, 100]} />
          </Sub>
        )}
      </section>

      {/* ── 右:測試狀態總覽 ── */}
      <section className="dut-wall-band field-card">
        {/* 標題列:標題 | 測項代碼 | 測項名稱 | 優化狀態,各占一台電視寬(間距跨拼接縫)。
            測試項目放在同一行,底下的小卡才能往上長 */}
        <div className="field-card-head">
          <div className="field-head-row">
            <div className="dut-wall-band-title">測試狀態總覽</div>
            <span className="flex min-w-0 items-baseline gap-6 text-sm">
              <span className="flex-none text-white/55">測試項目</span>
              <span className="min-w-0 truncate font-mono">{mission.testcase.code}</span>
            </span>
            <span className="min-w-0 truncate text-sm text-white/60">{mission.testcase.procedure}</span>
            <span
              className={`flex items-center justify-self-end gap-4 rounded-full border px-8 text-base ${
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
        </div>

        <div className="field-status-body">
          <Sub icon={Route} title={sc.routeTitle} aside={<PhaseLegend />}>
            <RouteMap mission={mission} />
            <MissionProgress mission={mission} />
          </Sub>

          {sc.throughputOnRight ? (
            /* 上半 UE 吞吐量、下半移動狀態,兩張小卡的間距跨 y = 2160 */
            <div className="field-stack">
              <Sub icon={Users} title="場域 UE 吞吐量" aside={run ? `${run.ueThroughput.length} 台 UE` : undefined}>
                {run && <UeThroughputChart run={run} xTicks={[0, 50, 100]} />}
              </Sub>
              <Sub
                icon={MOTION_ICON[scenario]}
                title={sc.motion.title}
                aside={motionSummary(sc.motion.charts[0], sc.motion.stat, run?.samples.at(-1))}
              >
                {/* 小卡矮:圖表標題併進小卡標題列,高度留給圖 */}
                <TrendChart spec={sc.motion.charts[0]} series={currentOnly} bare />
              </Sub>
            </div>
          ) : (
            <Sub icon={MOTION_ICON[scenario]} title={sc.motion.title}>
              {/* 上下兩張圖的間距跨 y = 2160 */}
              <div className="field-split">
                {sc.motion.charts.map((spec) => (
                  <TrendChart key={spec.metric} spec={spec} series={currentOnly} />
                ))}
              </div>
            </Sub>
          )}

          <Sub icon={Signal} title="訊號狀態">
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

// ── 場域 UE 吞吐量 ───────────────────────────────────────────────────

/** 各 UE 線的去強調色(灰):10 條線不各給一個色相,只凸顯平均 */
const UE_LINE = "rgba(255,255,255,0.28)";

/**
 * 場域內各 UE 的吞吐量(目前這趟),x 為路徑進度。
 * 10 台 UE 超過類別色的上限(8),所以各 UE 一律灰色當背景,平均線用這趟的代表色凸顯。
 */
function UeThroughputChart({ run, xTicks }: { run: FieldRun; xTicks: number[] }) {
  const ues = run.ueThroughput;
  const byProgress = new Map<number, Record<string, number>>();
  ues.forEach((u) =>
    u.samples.forEach((pt) => {
      const row = byProgress.get(pt.progress) ?? { progress: pt.progress };
      row[u.ue] = pt.mbps;
      byProgress.set(pt.progress, row);
    }),
  );
  type Row = Record<string, number> & { progress: number; avg: number };
  const rows: Row[] = [...byProgress.values()]
    .sort((a, b) => a.progress - b.progress)
    .map((row) => {
      const values = ues.map((u) => row[u.ue]).filter((v): v is number => v !== undefined);
      const avg = values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : 0;
      return { ...row, progress: row.progress, avg };
    });
  const last = rows.at(-1);
  const color = PHASE[run.phase].color;

  // y 軸:折線不需要從 0 起算,貼著資料範圍取整,刻度用整齊的 50 / 100 間隔,10 條線才分得開
  const all = ues.flatMap((u) => u.samples.map((pt) => pt.mbps));
  const yLo = all.length ? Math.max(0, Math.floor((Math.min(...all) - 10) / 50) * 50) : 0;
  const yHi = all.length ? Math.ceil((Math.max(...all) + 10) / 50) * 50 : 100;
  const yStep = yHi - yLo > 200 ? 100 : 50;
  const yTicks = Array.from({ length: Math.floor((yHi - yLo) / yStep) + 1 }, (_, i) => yLo + i * yStep);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-4 flex flex-none items-baseline gap-5 whitespace-nowrap">
        <span className="text-sm text-white/60">平均</span>
        <span className="text-[2.75rem] font-semibold leading-[1.1] text-white">
          {last ? Math.round(last.avg) : "—"}
        </span>
        <span className="text-sm text-white/50">Mbps</span>
        <span className="ml-auto flex items-center gap-8 text-sm text-white/70">
          <span className="flex items-center gap-3">
            <span className="inline-block h-[6px] w-12 rounded-full" style={{ background: UE_LINE }} />
            各 UE
          </span>
          <span className="flex items-center gap-3">
            <span className="inline-block h-[6px] w-12 rounded-full" style={{ background: color }} />
            平均
          </span>
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 24, right: 130, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeWidth={3} vertical={false} />
            <XAxis
              dataKey="progress"
              type="number"
              domain={[0, 100]}
              ticks={xTicks}
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
              width={150}
              domain={[yLo, yHi]}
              ticks={yTicks}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.35)", strokeWidth: 3 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const avg = payload.find((it) => it.dataKey === "avg")?.value;
                const values = payload.filter((it) => it.dataKey !== "avg").map((it) => Number(it.value));
                return (
                  <div
                    style={{
                      background: "rgba(10,23,47,0.94)",
                      border: "3px solid rgba(255,255,255,0.2)",
                      borderRadius: 16,
                      padding: "16px 24px",
                      fontSize: 64,
                      color: "#FFFFFF",
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ color: "rgba(255,255,255,0.7)" }}>路徑進度 {label}%</div>
                    <div>平均 {avg === undefined ? "—" : Math.round(Number(avg))} Mbps</div>
                    {values.length > 0 && (
                      <div>
                        最高 {Math.max(...values)} · 最低 {Math.min(...values)} Mbps
                      </div>
                    )}
                  </div>
                );
              }}
            />
            {ues.map((u) => (
              <Line
                key={u.ue}
                dataKey={u.ue}
                type="monotone"
                stroke={UE_LINE}
                strokeWidth={4}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            ))}
            <Line
              dataKey="avg"
              type="monotone"
              stroke={color}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 12, fill: color, stroke: CHART_SURFACE, strokeWidth: 6 }}
              isAnimationActive={false}
            />
            {last && (
              <ReferenceDot
                x={last.progress}
                y={last.avg}
                r={12}
                fill={color}
                stroke={CHART_SURFACE}
                strokeWidth={6}
                ifOverflow="visible"
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── 測試路徑 ─────────────────────────────────────────────────────────

/** 同一條路徑上疊出兩趟軌跡(開啟前 / 開啟後)與載具目前位置 */
function RouteMap({ mission }: { mission: FieldMission }) {
  const { route, runs, headingDeg } = mission;
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
        {/* 先畫開啟前、再畫開啟後,重疊的路段以開啟後為準 */}
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
              transform={`rotate(${headingDeg}) scale(${1.2 * u})`}
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

/** 路徑圖下方:目前這趟的任務進度(左)與階段(右),欄距跨 x = 5760 */
function MissionProgress({ mission }: { mission: FieldMission }) {
  const run = mission.runs[mission.currentRun];
  if (!run) return null;
  const pct = Math.round(Math.min(Math.max(run.progress, 0), 100));
  const phase = PHASE[run.phase];
  return (
    <div className="field-map-foot">
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

/** 移動狀態小卡標題列的數值摘要,例如「0.69 m/s · 電量 88%」 */
function motionSummary(chart: TrendSpec, stat: TrendSpec | undefined, latest: FieldSample | undefined) {
  const fmt = (spec: TrendSpec) => {
    const v = sampleValue(latest, spec.metric);
    return v === null ? "—" : `${v.toFixed(spec.digits)}${spec.unit === "%" ? "" : " "}${spec.unit}`;
  };
  return stat ? `${fmt(chart)} · ${stat.label} ${fmt(stat)}` : fmt(chart);
}

const RUN_STATUS: Record<FieldRun["status"], string> = {
  pending: "待命",
  running: "進行中",
  finished: "已完成",
  error: "錯誤",
};

// ── 折線圖(移動狀態 / 訊號狀態)──────────────────────────────────────

/** 訊號狀態的兩張圖(兩個情境相同) */
const SIGNAL_CHARTS: [TrendSpec, TrendSpec] = [
  { label: "SNR", unit: "dB", metric: "snrDb", digits: 1 },
  { label: "下行速率", unit: "Mbps", metric: "dlMbps", digits: 0 },
];

/** 圖表字級與筆畫都以牆面 3× 畫布計:2px 線 = 6、1px 格線 = 3 */
const AXIS_TICK = { fontSize: 72, fill: "rgba(255,255,255,0.6)" };
/** 圖表底色(小卡疊在大卡上的近似色),端點外圈用它隔開線條 */
const CHART_SURFACE = "#16263A";

const sampleValue = (pt: FieldSample | undefined, metric: TrendMetric) => pt?.[metric] ?? null;

/**
 * 一張折線圖:x 為路徑進度(%),一條線一趟。
 * 標題列顯示目前這趟的最新值。多條線時圖例由所屬小卡放一次(單條線由標題說明)。
 * bare = 不畫圖表自己的標題列(由所屬小卡的標題列顯示數值)。
 */
function TrendChart({
  spec: { label, unit, metric, digits },
  series,
  bare = false,
}: {
  spec: TrendSpec;
  series: { phase: OptimizationPhase; samples: FieldSample[] }[];
  bare?: boolean;
}) {
  // 依 progress 合併成一列一個 x;沒跑到的進度留空,線自然停在目前位置
  const byProgress = new Map<number, Record<string, number>>();
  series.forEach((s) =>
    s.samples.forEach((pt) => {
      const v = sampleValue(pt, metric);
      if (v === null) return;
      const row = byProgress.get(pt.progress) ?? { progress: pt.progress };
      row[s.phase] = v;
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
              labelFormatter={(v) => `路徑進度 ${v}%`}
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
              const v = sampleValue(end, metric);
              return end && v !== null ? (
                <ReferenceDot
                  key={`end-${s.phase}`}
                  x={end.progress}
                  y={v}
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
