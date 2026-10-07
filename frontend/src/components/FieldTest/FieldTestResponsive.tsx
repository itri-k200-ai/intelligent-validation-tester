"use client";
import { Bot, Plane, Route, Signal, Video, type LucideIcon } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { FieldAssistant } from "@/components/FieldTest/FieldAssistant";
import { FieldReportDialog } from "@/components/FieldTest/FieldReportDialog";
import { ReplayPlayer } from "@/components/FieldTest/ReplayPlayer";
import { RouteMap } from "@/components/FieldTest/RouteMap";
import { SceneMap3D } from "@/components/FieldTest/SceneMap3D";
import { FieldHlsVideo } from "@/components/Site/FieldHlsVideo";
import { SnapshotVideo, VideoBadge } from "@/components/Site/SnapshotVideo";
import type { TrendSpec } from "@/config/fieldScenarios";
import { useFieldView } from "@/hooks/FieldTest/useFieldView";
import { frameAt, replayCameraFor, snapshotSources } from "@/lib/fieldCameras";
import {
  PHASE,
  PROGRESS_COLOR,
  STAGE_COLOR,
  STAGE_LABEL,
  runTime,
  signalReadings,
  vehicleReadings,
  type Reading,
} from "@/lib/fieldView";
import { pickRateUnit } from "@/lib/formatRate";
import { cn } from "@/lib/cn";
import { useFieldScenarioStore } from "@/stores/fieldScenarioStore";
import type { FieldMission, FieldRun, FieldSample, FieldScenarioId, OptimizationPhase } from "@/types/fieldTest";

// ── 場域測試:一般電腦 / 手機版(RWD)────────────────────────────────────
// 內容與中牆(FieldTestWall)相同,版面改成一般螢幕的閱讀順序。資料與回放規則都來自
// useFieldView,與中牆共用 lib/fieldView 的欄位、顏色、階段名稱。
//
//   手機(單欄,由上往下):狀態列 → 進度 → 路徑圖 → 載具 / 通訊數值 → 測試數據 → 影像
//   平板(md):數值兩張並排、影像兩欄
//   桌機(lg):左欄 影像 + 數值,右欄 進度 + 路徑圖 + 測試數據
//
// 情境(室內 / 室外)與中牆同一套規則:跟著「最後一次操作」自動切換,
// 使用者自己點了分頁就以點的為準,直到下一次操作(見 FieldTestScenarioContainer)。

const VEHICLE_ICON: Record<FieldScenarioId, LucideIcon> = { outdoor: Plane, indoor: Bot };
const TABS: { id: FieldScenarioId; label: string }[] = [
  { id: "outdoor", label: "室外" },
  { id: "indoor", label: "室內" },
];

export function FieldTestResponsive({
  title = "智慧網路場域測試",
  controls,
}: {
  title?: string;
  /** 操作區塊(驗測控制頁 /field/control 用);檢視頁 /field 不給,維持只能看 */
  controls?: (p: { scenario: FieldScenarioId; running: boolean }) => ReactNode;
} = {}) {
  const scenario = useFieldScenarioStore((s) => s.scenario);
  const pickScenario = useFieldScenarioStore((s) => s.pickScenario);
  const v = useFieldView(scenario);
  const { sc, mission } = v;
  const at = runTime(mission);
  const dpr = useDpr();
  const status = statusLabel(v.running, v.replaying, v.hasData);

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-4 pb-24">
      {/* ── 標題列:情境分頁 + 狀態 ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium tracking-tight text-white md:text-2xl">{title}</h1>
          <StatusChip running={v.running} replaying={v.replaying} hasData={v.hasData} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="測試情境" className="flex rounded-full bg-white/5 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={t.id === scenario}
              onClick={() => pickScenario(t.id)}
              className={cn(
                "rounded-full px-5 py-1.5 text-sm transition-colors",
                t.id === scenario ? "bg-mint text-dark-text font-semibold" : "text-white/70 hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <FieldReportDialog mission={mission} status={status} />
        </div>
      </div>

      {/* ── 測試資訊 ── */}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-section border border-white/10 bg-navy-500/60 px-4 py-3 text-sm sm:grid-cols-3">
        <Meta k="測試環境" v={mission.testcase.environment} />
        <Meta k="測試項目" v={mission.testcase.name} />
        <Meta k={at?.label ?? "驗測時間"} v={at?.at ?? "—"} />
      </dl>

      {controls?.({ scenario, running: v.running })}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ── 右欄(手機排在前面):進度 + 路徑 + 測試數據 ── */}
        <div className="flex min-w-0 flex-col gap-4 lg:order-2 lg:col-span-7">
          <Panel icon={Route} title={sc.routeTitle}>
            <Progress mission={mission} percent={v.percent} stage={v.stage} />
            <div className="mt-3 flex h-56 flex-col sm:h-80 lg:h-[420px]">
              {scenario === "outdoor" && v.scene ? (
                <SceneMap3D scene={v.scene} tracks={v.sceneTracks} uav={v.sceneUav} pixelRatio={dpr} />
              ) : (
                <RouteMap
                  mission={scenario === "outdoor" ? v.mapMission : v.play}
                  floorPlan={sc.floorPlan}
                  backdrop={sc.backdrop}
                  livePosition={v.position}
                  realFrame={scenario === "outdoor" && v.realFrame}
                />
              )}
            </div>
          </Panel>

          <Panel icon={Signal} title="測試數據" aside={<PhaseLegend />}>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {RATE_CHARTS.map((spec) => (
                <CompareChart key={spec.metric} spec={spec} runs={v.play.runs} />
              ))}
            </div>
          </Panel>
        </div>

        {/* ── 左欄:數值 + 影像(桌機影像在上,手機數值在上 —— 影像最佔流量也最不急)── */}
        <div className="flex min-w-0 flex-col gap-4 lg:order-1 lg:col-span-5">
          <div className="order-1 grid grid-cols-1 gap-4 md:grid-cols-2 lg:order-2 lg:grid-cols-1 xl:grid-cols-2">
            <Panel icon={VEHICLE_ICON[scenario]} title={sc.live.vehicleTitle}>
              <Metrics items={vehicleReadings(scenario, v.vehicle, v.position, v.geo)} />
            </Panel>
            <Panel icon={Signal} title={sc.live.signalTitle}>
              <Metrics items={signalReadings(v.link)} />
            </Panel>
          </div>

          <Panel className="order-2 lg:order-1" icon={Video} title="影像">
            <Cameras scenario={scenario} labels={sc.cameras} view={v} />
          </Panel>
        </div>
      </div>

      <FieldAssistant
        ctx={{
          scenarioLabel: scenario === "outdoor" ? "室外" : "室內",
          testName: mission.testcase.name,
          environment: mission.testcase.environment,
          status,
          percent: v.percent,
          stage: v.stage,
          link: v.link,
          vehicle: v.vehicle,
          position: v.position,
          geo: v.geo,
          runs: v.play.runs,
        }}
      />
    </div>
  );
}

// ── 小元件 ───────────────────────────────────────────────────────────

function statusLabel(running: boolean, replaying: boolean, hasData: boolean) {
  if (running) return "執行中";
  if (replaying) return "歷史回放";
  return hasData ? "已結束" : "尚無資料";
}

function StatusChip({ running, replaying, hasData }: { running: boolean; replaying: boolean; hasData: boolean }) {
  if (running)
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-semibold text-mint">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
        執行中
      </span>
    );
  if (replaying)
    return <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">歷史回放</span>;
  if (hasData) return <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/70">已結束</span>;
  return <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-white/50">尚無資料</span>;
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex min-w-0 items-baseline gap-3">
      <dt className="flex-none text-white/55">{k}</dt>
      <dd className="min-w-0 truncate text-white">{v}</dd>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  aside,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("min-w-0 rounded-section border border-white/10 bg-navy-500/60 p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 flex-none text-teal" strokeWidth={1.75} />
        <h2 className="flex-none text-base font-semibold text-white">{title}</h2>
        {aside && <div className="ml-auto min-w-0">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/** 3 欄 × 2 列的數值:標籤(含單位)在上、數值在下 */
function Metrics({ items }: { items: Reading[] }) {
  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-4">
      {items.map(({ label, unit, value, tone = "text-white" }) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs text-white/55">
            {label}
            {unit && <span className="ml-1 text-white/35">{unit}</span>}
          </span>
          <span
            className={cn(
              "truncate text-lg font-semibold tabular-nums leading-tight sm:text-xl",
              value === null ? "text-white/40" : tone,
            )}
          >
            {value ?? "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 測試進度:三段條(app 部署前 / 中 / 後),規則同中牆的 MissionProgress(single) */
function Progress({ mission, percent, stage }: { mission: FieldMission; percent: number | null; stage?: string }) {
  const p = mission.process;
  const total = p?.total ?? 0;
  const doneSteps = percent !== null && total ? (percent / 100) * total : (p?.done ?? 0);
  const segs = p?.stages?.length ? p.stages : null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm text-white/60">測試進度</span>
      {/* 固定寬度放得下「100%」:數字變長時後面的字與條子才不會跟著跳 */}
      <span className="w-[4.5rem] text-2xl font-semibold tabular-nums text-white">
        {percent === null ? "—" : `${percent}%`}
      </span>
      {stage && <span className="text-sm text-white/75">{stage}</span>}
      <div className="flex h-2.5 w-full gap-1 sm:w-auto sm:min-w-[160px] sm:flex-1">
        {segs ? (
          segs.map((seg) => {
            const span = Math.max(1, seg.to - seg.from);
            const filled = Math.min(1, Math.max(0, (doneSteps - seg.from) / span)) * 100;
            return (
              <div
                key={seg.kind + seg.from}
                className="h-full overflow-hidden rounded-full bg-white/15"
                style={{ flexGrow: span, flexBasis: 0 }}
                title={STAGE_LABEL[seg.kind]}
              >
                <div className="h-full rounded-full" style={{ width: `${filled}%`, background: STAGE_COLOR[seg.kind] }} />
              </div>
            );
          })
        ) : (
          <div className="h-full flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full" style={{ width: `${percent ?? 0}%`, background: PROGRESS_COLOR }} />
          </div>
        )}
      </div>
    </div>
  );
}

function PhaseLegend() {
  return (
    <span className="flex items-center gap-3 text-xs text-white/70">
      {(["before", "after"] as const).map((p) => (
        <span key={p} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: PHASE[p].color }} />
          {PHASE[p].label}
        </span>
      ))}
    </span>
  );
}

// ── 影像 ─────────────────────────────────────────────────────────────

function Cameras({
  scenario,
  labels,
  view,
}: {
  scenario: FieldScenarioId;
  labels: readonly string[];
  view: ReturnType<typeof useFieldView>;
}) {
  const srcs = snapshotSources(scenario);
  return (
    // 室內 4 路:手機也排 2×2,一路一列要滑很久;室外 2 路:手機一路一列,看得清楚
    <div className={cn("grid gap-3", labels.length > 2 ? "grid-cols-2" : "grid-cols-1 min-[420px]:grid-cols-2")}>
      {labels.map((label, i) => {
        // 回放:這一格對應的鏡頭,在目前播到的時刻該顯示的那一張(規則同中牆)
        const cam = view.replaying ? replayCameraFor(scenario, i, view.replayCams) : null;
        const at = cam ? frameAt(cam, view.replayWall) : null;
        return (
          <figure key={label} className="min-w-0">
            <div className="relative aspect-video overflow-hidden rounded-item">
              {cam && at !== null ? (
                <div className="field-rwd-replay h-full w-full">
                  <ReplayPlayer scenario={scenario} camera={cam} at={at} />
                </div>
              ) : view.replaying ? (
                // 回放中但這支鏡頭沒存影格:不能改播即時(理由同中牆),轉圈 + 標「回放」
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <span className="video-spinner !h-8 !w-8 !border-[3px]" />
                  <VideoBadge kind="replay" />
                </div>
              ) : srcs[i]?.endsWith(".m3u8") ? (
                <FieldHlsVideo
                  src={srcs[i]!}
                  badge={<VideoBadge kind="live" />}
                  spinner={<span className="video-spinner !h-8 !w-8 !border-[3px]" />}
                />
              ) : (
                <SnapshotVideo src={srcs[i] ?? null} alt={label} />
              )}
            </div>
            <figcaption className="mt-1.5 truncate text-xs text-white/70">{label}</figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// ── 測試數據 ─────────────────────────────────────────────────────────

/** 同中牆:上行、下行各一張,比兩趟的平均 */
const RATE_CHARTS: TrendSpec[] = [
  { label: "平均上行", unit: "kbps", metric: "ulKbps", digits: 1, kind: "rate" },
  { label: "平均下行", unit: "kbps", metric: "dlKbps", digits: 0, kind: "rate" },
];
/** 橫軸刻度間隔(秒),同中牆:固定是它的整數倍 */
const X_TICK_S = 30;

function sampleSecond(pt: FieldSample | undefined): number | null {
  if (!pt) return null;
  return pt.elapsedS ?? pt.wall ?? null;
}

function CompareChart({ spec, runs }: { spec: TrendSpec; runs: FieldRun[] }) {
  // 每一趟各算自己的平均(同中牆:第一趟跑完就固定,不會跟著第二趟變)
  const mean = (phase: OptimizationPhase) => {
    const vals = (runs.find((r) => r.phase === phase)?.samples ?? [])
      .map((pt) => pt[spec.metric] ?? null)
      .filter((x): x is number => x !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const before = mean("before");
  const after = mean("after");
  const unit = pickRateUnit([before, after]);
  const fmt = (x: number | null) => (x === null ? "—" : (x / unit.scale).toFixed(unit.digits));
  const d = before !== null && after !== null ? after - before : null;

  // 橫軸:每一趟各自從 0 秒起算,兩條線才對得起來
  const byT = new Map<number, Record<string, number>>();
  for (const r of runs) {
    const t0 = sampleSecond(r.samples.find((pt) => sampleSecond(pt) !== null));
    for (const pt of r.samples) {
      const val = pt[spec.metric];
      const sec = sampleSecond(pt);
      if (val == null || sec === null || t0 === null) continue;
      const t = Math.round(sec - t0);
      const row = byT.get(t) ?? { t };
      row[r.phase] = val / unit.scale;
      byT.set(t, row);
    }
  }
  const rows = [...byT.values()].sort((a, b) => a.t - b.t);
  const maxT = rows.length ? rows[rows.length - 1].t : 0;
  const axisMax = Math.max(120, Math.ceil(maxT / X_TICK_S) * X_TICK_S);
  const xTicks: number[] = [];
  for (let t = 0; t <= axisMax; t += X_TICK_S) xTicks.push(t);

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-sm text-white/60">{spec.label}</span>
        {/* 第一趟還在跑時不標數值(同中牆:標出來只會是「12.4 → —」) */}
        {after !== null && (
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="flex items-baseline gap-1">
              <Dot phase="before" />
              <span className="text-base tabular-nums text-white/70">{fmt(before)}</span>
            </span>
            <span className="text-xs text-white/35">→</span>
            <span className="flex items-baseline gap-1">
              <Dot phase="after" />
              <span className="text-lg font-semibold tabular-nums text-white">{fmt(after)}</span>
            </span>
            <span className="text-xs text-white/50">{unit.unit}</span>
            {d !== null && (
              <span className={cn("text-xs font-semibold", d >= 0 ? "text-mint" : "text-danger")}>
                {d > 0 ? "▲+" : d < 0 ? "▼" : ""}
                {(Math.abs(d) / unit.scale).toFixed(unit.digits)} {unit.unit}
              </span>
            )}
          </span>
        )}
      </div>
      {/* 縱軸單位獨立一行放在圖上方:疊在圖裡會跟最上面那個刻度擠在一起 */}
      <div className="text-[11px] text-white/45">{unit.unit}</div>
      <div className="h-44 sm:h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, axisMax]}
              ticks={xTicks}
              tickFormatter={(t: number) => `${t}s`}
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
              tickLine={false}
              stroke="rgba(255,255,255,0.2)"
              height={22}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }}
              tickLine={false}
              axisLine={false}
              width={40}
              tickCount={4}
              allowDecimals={unit.digits > 0}
              domain={["auto", "auto"]}
            />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.35)" }}
              contentStyle={{
                background: "rgba(10,23,47,0.94)",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                fontSize: 12,
                color: "#fff",
              }}
              labelFormatter={(t) => `第 ${t} 秒`}
              formatter={(val, name) => [
                `${Number(val).toFixed(unit.digits)} ${unit.unit}`,
                PHASE[name as OptimizationPhase]?.short ?? String(name),
              ]}
            />
            {runs.map((r) => (
              <Line
                key={r.phase}
                dataKey={r.phase}
                type="monotone"
                stroke={PHASE[r.phase].color}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Dot({ phase }: { phase: OptimizationPhase }) {
  return <span className="inline-block h-2 w-2 self-center rounded-full" style={{ background: PHASE[phase].color }} />;
}

/** 裝置像素比(上限 2:手機是 3,3D 畫布全解析度太吃電) */
function useDpr() {
  const [dpr, setDpr] = useState(1);
  useEffect(() => setDpr(Math.min(2, window.devicePixelRatio || 1)), []);
  return dpr;
}
