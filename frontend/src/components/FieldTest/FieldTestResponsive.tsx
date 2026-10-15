"use client";
import { Bot, Moon, Plane, Route, Signal, Sun, Video, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
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
import { FieldDriveButton } from "@/components/FieldTest/FieldDrivePanel";
import { FieldReportDialog } from "@/components/FieldTest/FieldReportDialog";
import { ReplayPlayer } from "@/components/FieldTest/ReplayPlayer";
import { RouteMap } from "@/components/FieldTest/RouteMap";
import { SceneMap3D } from "@/components/FieldTest/SceneMap3D";
import { FieldHlsVideo } from "@/components/Site/FieldHlsVideo";
import { FieldMjpegVideo } from "@/components/Site/LiveVideo";
import { VideoBadge } from "@/components/Site/SnapshotVideo";
import type { TrendSpec } from "@/config/fieldScenarios";
import { useFieldTestCamera } from "@/hooks/FieldTest/useFieldTestCamera";
import { useFieldTheme } from "@/hooks/FieldTest/useFieldTheme";
import { useFieldView } from "@/hooks/FieldTest/useFieldView";
import { cameraSources, frameAt, liveInReplay, replayCameraFor } from "@/lib/fieldCameras";
import {
  PHASE,
  PROGRESS_COLOR,
  STAGE_COLOR,
  STAGE_LABEL,
  processFraction,
  runTime,
  stageSpans,
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
// 情境(室內 / 室外)不自動跳轉,完全照使用者點的分頁(依現場要求;中牆才會跟著「最後一次操作」跳)。

/** 桌機一頁版:影像最多佔左欄高度的這個比例,超過就把格子縮小(留空間給數值與測試數據) */
const VIDEO_SHARE = 0.45;
/** 測試數據卡最少要留的高度(px)—— 影像格縮小時以它為底線,頁面才不會超出視窗 */
const DATA_MIN_PX = 160;

/** 右下角「場域測試小助理」要不要顯示 —— 先隱藏(依現場要求) */
const SHOW_ASSISTANT = false;

const VEHICLE_ICON: Record<FieldScenarioId, LucideIcon> = { outdoor: Plane, indoor: Bot };
const TABS: { id: FieldScenarioId; label: string }[] = [
  { id: "outdoor", label: "室外" },
  { id: "indoor", label: "室內" },
];

export function FieldTestResponsive({
  title = "智慧網路場域測試",
  controls,
  canDrive = true,
}: {
  title?: string;
  /** 操作區塊(驗測控制頁 /field/control 用);檢視頁 /field 不給,維持只能看 */
  controls?: (p: { scenario: FieldScenarioId; running: boolean }) => ReactNode;
  /**
   * 測試資訊列右邊要不要放「開始驗測」。來賓看的純監控頁(/field/view)傳 false ——
   * 那一頁只能看,不能讓來賓自己驅動載具。
   */
  canDrive?: boolean;
} = {}) {
  const scenario = useFieldScenarioStore((s) => s.scenario);
  const pickScenario = useFieldScenarioStore((s) => s.pickScenario);
  const v = useFieldView(scenario);
  const { sc, mission } = v;
  const at = runTime(mission);
  const dpr = useDpr();
  const status = statusLabel(v.running, v.replaying, v.hasData);
  const { theme, toggle } = useFieldTheme();

  const fit = !controls;
  // 桌機一頁版的左欄 —— 影像格的大小依它的高度算(見 Cameras 的 sized)
  const leftCol = useRef<HTMLDivElement>(null);
  const statusRow = useRef<HTMLDivElement>(null);
  const wide = useMediaQuery("(min-width: 1024px)");
  // 手機 / 平板橫放時影像分頁兩格並排,直放時上下疊
  const landscape = useMediaQuery("(orientation: landscape)");
  const [tab, setTab] = useState<MobileTab>("route");

  // ── 共用的區塊(捲動版 / 一頁版都用同一份)──
  const header = (
    <div className="flex flex-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <button
          type="button"
          onClick={toggle}
          aria-label={theme === "dark" ? "切換成亮色模式" : "切換成暗色模式"}
          title={theme === "dark" ? "亮色模式" : "暗色模式"}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white transition-colors hover:bg-white/10"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  // 右側的「開始驗測」只在檢視頁 /field 放;控制頁 /field/control 已經有完整的驅動區塊,
  // 來賓用的純監控頁 /field/view 則完全不放(canDrive = false)
  const meta = (
    <div
      className={cn(
        "flex flex-none rounded-section border border-white/10 bg-navy-500/60 text-sm",
        // 一頁版:按鈕一律放在同一列右邊(手機上少佔一整列高度)
        fit ? "flex-row items-center gap-2 px-3 py-2 lg:gap-3 lg:px-4 lg:py-3" : "flex-col gap-3 px-4 py-3 md:flex-row md:items-center",
      )}
    >
      <dl className={cn("grid min-w-0 flex-1 grid-cols-1 gap-x-6 sm:grid-cols-3", fit ? "gap-y-1" : "gap-y-2")}>
        <Meta k="測試環境" v={mission.testcase.environment} />
        <Meta k="測試項目" v={mission.testcase.name} />
        <Meta k={at?.label ?? "驗測時間"} v={at?.at ?? "—"} />
      </dl>
      {!controls && canDrive && <FieldDriveButton scenario={scenario} running={v.running} className="flex-none" />}
    </div>
  );

  // 手機 / 平板:階段文字平均分三欄 —— 某一段很短時(室外的「部署前」),對齊段寬的文字會跟隔壁疊在一起
  const progress = <Progress mission={mission} percent={v.percent} stage={v.stageKind} evenLabels={fit && !wide} />;

  const map =
    scenario === "outdoor" && v.scene ? (
      <SceneMap3D scene={v.scene} tracks={v.sceneTracks} uav={v.sceneUav} pixelRatio={dpr} />
    ) : (
      <RouteMap
        mission={scenario === "outdoor" ? v.mapMission : v.play}
        floorPlan={sc.floorPlan}
        backdrop={sc.backdrop}
        livePosition={v.position}
        realFrame={scenario === "outdoor" && v.realFrame}
      />
    );

  const vehiclePanel = (compact: boolean, narrow = false) => (
    <Panel icon={VEHICLE_ICON[scenario]} title={sc.live.vehicleTitle} className={cn("flex-none", compact && "!p-3")}>
      <Metrics compact={compact} narrow={narrow} items={vehicleReadings(scenario, v.vehicle, v.position, v.geo)} />
    </Panel>
  );
  const signalPanel = (compact: boolean, narrow = false) => (
    <Panel icon={Signal} title={sc.live.signalTitle} className={cn("flex-none", compact && "!p-3")}>
      <Metrics compact={compact} narrow={narrow} items={signalReadings(v.link)} />
    </Panel>
  );
  const statusPanels = (compact: boolean, narrow = false) => (
    <>
      {vehiclePanel(compact, narrow)}
      {signalPanel(compact, narrow)}
    </>
  );

  // 小助理先隱藏(依現場要求,/field、/field/view、/field/control 都不顯示);要恢復把 SHOW_ASSISTANT 改回 true
  const assistant = SHOW_ASSISTANT && (
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
      raised={fit && !wide}
    />
  );

  // ── 控制頁(/field/control):維持原本可捲動的版面,驅動區塊需要空間 ──
  if (!fit)
    return (
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4 pb-24">
        {header}
        {meta}
        {controls?.({ scenario, running: v.running })}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-4 lg:order-2 lg:col-span-7">
            <Panel icon={Route} title={sc.routeTitle}>
              {progress}
              <div className="field-keep-dark field-map-surface mt-3 flex h-56 flex-col sm:h-80 lg:h-[420px]">{map}</div>
            </Panel>
            <Panel icon={Signal} title="測試數據" aside={<PhaseLegend />}>
              <div className="grid grid-cols-1 gap-5">
                {RATE_CHARTS.map((spec) => (
                  <CompareChart key={spec.metric} spec={spec} runs={v.play.runs} />
                ))}
              </div>
            </Panel>
          </div>
          <div className="flex min-w-0 flex-col gap-4 lg:order-1 lg:col-span-5">
            <div className="order-1 grid grid-cols-1 gap-4 md:grid-cols-2 lg:order-2 lg:grid-cols-1">
              {statusPanels(false)}
            </div>
            <Panel className="order-2 lg:order-1" icon={Video} title="影像">
              <Cameras scenario={scenario} labels={sc.cameras} view={v} />
            </Panel>
          </div>
        </div>
        {assistant}
      </div>
    );

  // ── 檢視頁(/field):一頁剛好填滿畫面,不用捲(依現場要求:16:9、4:3、手機直式都一樣)──
  //   桌機(≥1024 寬):左欄 影像(撐滿)+ 兩張數值;右欄 路徑(含進度,約 3/5)+ 測試數據(約 2/5)
  //   手機 / 平板:上面固定標題、測試資訊、進度;中間是目前分頁;最下面「路徑 / 影像 / 數據」分頁列。
  //     只掛目前那一頁 —— 影像分頁沒打開就不開串流,不白佔上游名額
  // 高度 = 視窗高 - FieldAuthGate 的上下內距(手機 1rem×2、md 以上 1.5rem×2);用 dvh,手機網址列收合時不會被切掉
  return (
    <div className="mx-auto flex h-[calc(100dvh-2rem)] max-w-[1600px] flex-col gap-3 md:h-[calc(100dvh-3rem)] lg:gap-4">
      {header}
      {meta}
      {wide ? (
        // 左欄:影像(只佔需要的高度)→ 兩張數值卡並排 → 測試數據(吃掉剩下的高度);
        // 右欄整欄都是測試路徑(依現場要求:影像框不要留一大塊空,路徑圖放大)
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
          <div ref={leftCol} className="col-span-5 flex min-h-0 min-w-0 flex-col gap-4">
            <Panel className="flex-none !p-3 lg:!p-4" icon={Video} title="影像">
              <Cameras
                sized={{ budget: leftCol, share: VIDEO_SHARE, reserve: statusRow, reserveExtra: DATA_MIN_PX + 32 }}
                scenario={scenario}
                labels={sc.cameras}
                view={v}
              />
            </Panel>
            {/* 行駛狀態、通訊品質左右並排:上下疊會吃掉一大段高度。並排後每張卡變窄,
                數值改一列 2 個(見 Metrics 的 narrow) */}
            <div ref={statusRow} className="grid flex-none grid-cols-2 gap-4">{statusPanels(true, true)}</div>
            <Panel fill className="min-h-[160px] flex-1" icon={Signal} title="測試數據" aside={<PhaseLegend />}>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-4">
                {RATE_CHARTS.map((spec) => (
                  <CompareChart fill key={spec.metric} spec={spec} runs={v.play.runs} />
                ))}
              </div>
            </Panel>
          </div>
          <div className="col-span-7 flex min-h-0 min-w-0 flex-col">
            <Panel fill className="flex-1" icon={Route} title={sc.routeTitle}>
              {progress}
              <div className="field-keep-dark field-map-surface mt-2 flex min-h-0 flex-1 flex-col">{map}</div>
            </Panel>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-none rounded-section border border-white/10 bg-navy-500/60 px-3 py-2">{progress}</div>
          {/* 分頁內容吃掉剩下的高度。極矮的螢幕(手機橫放等)真的放不下時,只有這一塊自己捲,整頁不會捲 */}
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
            {/* 路徑:地圖 + 行駛狀態(位置、方向、速度跟地圖一起看);通訊品質放到「數據」 */}
            {tab === "route" && (
              <>
                <Panel fill className="min-h-[160px] flex-1" icon={Route} title={sc.routeTitle}>
                  <div className="field-keep-dark field-map-surface flex min-h-0 flex-1 flex-col">{map}</div>
                </Panel>
                {vehiclePanel(true)}
              </>
            )}
            {/* 影像:每格維持 16:9、整個畫面都看得到,直放一格一列,放不下就讓這一塊往下捲
                (依現場回饋:撐滿高度時格子被壓成別的比例,畫面兩側 / 上下被裁掉,東西看不到) */}
            {tab === "video" && (
              <Panel className="flex-none" icon={Video} title="影像">
                <Cameras single={!landscape} scenario={scenario} labels={sc.cameras} view={v} />
              </Panel>
            )}
            {tab === "data" && signalPanel(true)}
            {/* 數據:圖表固定高度(不撐滿),放不下就讓這一塊往下捲 —— 撐滿時兩張圖被壓得很扁,
                標題列的「啟用前 → 啟用後」換行後還會跟圖疊在一起(依現場回饋) */}
            {tab === "data" && (
              <Panel className="flex-none" icon={Signal} title="測試數據" aside={<PhaseLegend />}>
                <div className="grid grid-cols-1 gap-5">
                  {RATE_CHARTS.map((spec) => (
                    <CompareChart key={spec.metric} spec={spec} runs={v.play.runs} />
                  ))}
                </div>
              </Panel>
            )}
          </div>
          <MobileTabBar tab={tab} onPick={setTab} />
        </>
      )}
      {assistant}
    </div>
  );
}

type MobileTab = "route" | "video" | "data";
const MOBILE_TABS: { id: MobileTab; label: string; icon: LucideIcon }[] = [
  { id: "route", label: "路徑", icon: Route },
  { id: "video", label: "影像", icon: Video },
  { id: "data", label: "數據", icon: Signal },
];

/** 手機 / 平板最下面的分頁列(一頁版用) */
function MobileTabBar({ tab, onPick }: { tab: MobileTab; onPick: (t: MobileTab) => void }) {
  return (
    <nav
      role="tablist"
      aria-label="內容"
      className="grid flex-none grid-cols-3 gap-1 rounded-section border border-white/10 bg-navy-500/80 p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))]"
    >
      {MOBILE_TABS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tab === id}
          onClick={() => onPick(id)}
          className={cn(
            "flex items-center justify-center gap-1.5 rounded-item py-2 text-sm transition-colors",
            // 沒選到的也用全白(原本 70% 白在深底上對比不夠);選到的是薄荷底 + 深色字
            tab === id ? "bg-mint font-semibold text-dark-text" : "text-white hover:bg-white/10",
          )}
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </nav>
  );
}

/** 媒體查詢:第一次 render 先當作不符合(伺服器端沒有視窗),掛上之後照實際尺寸、跟著視窗變 */
function useMediaQuery(query: string) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return match;
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
  fill = false,
  children,
}: {
  icon: LucideIcon;
  title: string;
  aside?: ReactNode;
  className?: string;
  /** 撐滿外層給的高度(一頁不捲的版面用):內容區吃掉標題以外的全部高度 */
  fill?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "min-w-0 rounded-section border border-white/10 bg-navy-500/60",
        fill ? "flex min-h-0 flex-col p-3 lg:p-4" : "p-4",
        className,
      )}
    >
      <div className={cn("flex flex-none items-center gap-2", fill ? "mb-2" : "mb-3")}>
        <Icon className="h-5 w-5 flex-none text-teal" strokeWidth={1.75} />
        <h2 className="flex-none text-base font-semibold text-white">{title}</h2>
        {aside && <div className="ml-auto min-w-0">{aside}</div>}
      </div>
      {fill ? <div className="flex min-h-0 flex-1 flex-col">{children}</div> : children}
    </section>
  );
}

/** 3 欄 × 2 列的數值:標籤(含單位)在上、數值在下 */
function Metrics({
  items,
  compact = false,
  narrow = false,
}: {
  items: Reading[];
  compact?: boolean;
  /** 卡片並排、變窄時:一列 2 個(螢幕夠寬才 3 個),不然經緯度、「垂直速度 m/s」會被截掉 */
  narrow?: boolean;
}) {
  return (
    <div
      className={cn(
        "grid gap-x-3",
        narrow ? "grid-cols-2 2xl:grid-cols-3" : "grid-cols-3",
        compact ? "gap-y-2" : "gap-y-4",
      )}
    >
      {items.map(({ label, unit, value, tone = "text-white" }) => (
        <div key={label} className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-xs text-white/55">
            {label}
            {unit && <span className="ml-1 text-white/35">{unit}</span>}
          </span>
          <span
            className={cn(
              "truncate font-semibold tabular-nums leading-tight",
              compact ? "text-base xl:text-lg" : "text-lg sm:text-xl",
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

/** 測試進度:三段條(app 啟動前 / 中 / 後),規則同中牆的 MissionProgress(single) */
function Progress({
  mission,
  percent,
  stage,
  evenLabels = false,
}: {
  mission: FieldMission;
  percent: number | null;
  stage?: string;
  /** 階段文字不對齊各段,改成平均分三欄放在條子下面(窄螢幕用,見呼叫端) */
  evenLabels?: boolean;
}) {
  const p = mission.process;
  // 段寬與填色都照時間比例(同中牆,見 lib/fieldView 的 stageSpans / processFraction)
  const f = percent !== null ? percent / 100 : (processFraction(p) ?? 0);
  const segs = stageSpans(p);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="text-sm text-white/60">測試進度</span>
      {/* 固定寬度放得下「100%」:數字變長時後面的字與條子才不會跟著跳 */}
      <span className="w-[4.5rem] text-2xl font-semibold tabular-nums text-white">
        {percent === null ? "—" : `${percent}%`}
      </span>
      <div className={cn("w-full sm:w-auto sm:min-w-[160px] sm:flex-1", evenLabels && segs && "flex flex-col gap-1")}>
      <div className="flex w-full gap-1">
        {segs ? (
          segs.map((seg) => {
            const span = Math.max(1e-6, seg.end - seg.start);
            const filled = Math.min(1, Math.max(0, (f - seg.start) / span)) * 100;
            return (
              // 三段的文字都標在各自那一段下面,目前這段亮、其他暗(同中牆)
              <div key={seg.kind} className="flex min-w-0 flex-col gap-1" style={{ flexGrow: span, flexBasis: 0 }}>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/15" title={STAGE_LABEL[seg.kind]}>
                  <div className="h-full rounded-full" style={{ width: `${filled}%`, background: STAGE_COLOR[seg.kind] }} />
                </div>
                {!evenLabels && STAGE_LABEL[seg.kind] && (
                  <span
                    className={cn(
                      // 中間那段很窄:文字超出段寬、置中在底下,不要被截成「app …」
                      "w-max self-center whitespace-nowrap text-xs",
                      seg.kind === stage ? "font-semibold text-white" : "text-white/45",
                    )}
                  >
                    {STAGE_LABEL[seg.kind]}
                  </span>
                )}
              </div>
            );
          })
        ) : (
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full" style={{ width: `${percent ?? 0}%`, background: PROGRESS_COLOR }} />
          </div>
        )}
      </div>
      {evenLabels && segs && (
        <div className="grid grid-cols-3 gap-1">
          {segs
            .filter((seg) => STAGE_LABEL[seg.kind])
            .map((seg) => (
              <span
                key={seg.kind}
                className={cn(
                  "truncate text-center text-xs",
                  seg.kind === stage ? "font-semibold text-white" : "text-white/45",
                )}
              >
                {STAGE_LABEL[seg.kind]}
              </span>
            ))}
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
  fill = false,
  stack = false,
  single = false,
  sized,
}: {
  scenario: FieldScenarioId;
  labels: readonly string[];
  view: ReturnType<typeof useFieldView>;
  /** 撐滿外層高度:格子不再固定 16:9,依可用空間分(畫面 object-cover 裁切) */
  fill?: boolean;
  /** 只有兩格時上下疊(手機直式),不左右並排 */
  stack?: boolean;
  /** 一格一列(手機直式看影像):每格都是整個螢幕寬、16:9 */
  single?: boolean;
  /**
   * 依欄寬算格子大小、框只包住影像本身(不撐滿、不留空),但高度最多佔 budget 的 share ——
   * 桌機一頁版左欄用(見 useSizedGrid)
   */
  sized?: SizedBudget;
}) {
  // 跟中牆同一套來源與播法(依現場要求;以前是每 2 秒抓一張快照,只有 0.5 fps 看起來很卡):
  // 固定攝影機開 MJPEG 串流、52 館屋頂播 HLS,車載先查狀態、名額沒滿才開(見 useFieldTestCamera)。
  // ⚠ 每支攝影機上游同時只給 3 路,每多一個人開 /field 就少一路給電視牆。
  const { streamUrl } = useFieldTestCamera(scenario);
  const srcs = view.missionSettled
    ? cameraSources(scenario).map((src, i, all) => (i === all.length - 1 ? streamUrl : src))
    : cameraSources(scenario).map(() => null);
  const renderTile = (label: string, i: number, fill: boolean) => {
        // 回放:這一格對應的鏡頭,在目前播到的時刻該顯示的那一張(規則同中牆)
        const cam = view.replaying ? replayCameraFor(scenario, i, view.replayCams) : null;
        const at = cam ? frameAt(cam, view.replayWall) : null;
        const tile = (
            <div className="field-keep-dark relative aspect-video w-full overflow-hidden rounded-item">
              {cam && at !== null ? (
                <div className="field-rwd-replay h-full w-full">
                  <ReplayPlayer scenario={scenario} camera={cam} at={at} />
                </div>
              ) : view.replaying && liveInReplay(scenario, i) && srcs[i]?.endsWith(".m3u8") ? (
                // 室外固定攝影機沒有回放功能:回放時也播即時、標「LIVE」(規則同中牆)
                <FieldHlsVideo
                  src={srcs[i]!}
                  badge={<VideoBadge kind="live" />}
                  spinner={<span className="video-spinner !h-8 !w-8 !border-[3px]" />}
                />
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
                <FieldLiveTile src={srcs[i] ?? null} alt={label} />
              )}
            </div>
        );
        const caption = <figcaption className="mt-1.5 truncate text-xs text-white/70">{label}</figcaption>;
        // 撐滿版面時:每格一律 16:9,寬度取「放得下的寬」與「放得下的高 × 16/9」較小的那個,置中 ——
        // 以前格子直接撐成可用空間的形狀,矮螢幕(筆電)上被壓成扁長條、畫面上下被裁掉一大半(依現場回饋)。
        // 用 container query(cqw / cqh)量這一格分到的空間;1.5rem 是底下名稱那一行。
        if (fill)
          return (
            <figure key={label} className="flex min-h-0 min-w-0 items-center justify-center [container-type:size]">
              <div className="flex flex-col" style={{ width: "min(100cqw, calc((100cqh - 1.5rem) * 16 / 9))" }}>
                {tile}
                {caption}
              </div>
            </figure>
          );
        return (
          <figure key={label} className="min-w-0">
            {tile}
            {caption}
          </figure>
        );
  };
  const best = useBestCols(labels.length, fill && !single);
  const fit = useSizedGrid(labels.length, sized);
  if (sized)
    return (
      <div
        ref={fit.ref}
        className="grid justify-center gap-3"
        style={fit.cols ? { gridTemplateColumns: `repeat(${fit.cols}, ${fit.tile}px)` } : { visibility: "hidden" }}
      >
        {labels.map((label, i) => renderTile(label, i, false))}
      </div>
    );
  return (
    // 撐滿版面時:排法依可用空間自己選(見 useBestCols);不撐滿時室內 2×2、室外並排或上下疊
    <div
      ref={best.ref}
      style={
        fill && best.cols
          ? {
              gridTemplateColumns: `repeat(${best.cols}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${Math.ceil(labels.length / best.cols)}, minmax(0, 1fr))`,
            }
          : undefined
      }
      className={cn(
        "grid gap-3",
        fill && "min-h-0 flex-1",
        single
          ? "grid-cols-1"
          : labels.length > 2
          ? cn("grid-cols-2", fill && "grid-rows-2")
          : fill
            ? stack
              ? "grid-cols-1 grid-rows-2"
              : "grid-cols-2 grid-rows-1"
            : "grid-cols-1 min-[420px]:grid-cols-2",
      )}
    >
      {labels.map((label, i) => renderTile(label, i, fill))}
    </div>
  );
}

/**
 * 撐滿版面時影像格要排成幾欄:量出可用的寬高,算每種欄數下 16:9 的格子能有多大,挑最大的。
 * 例:室外兩格在矮的筆電上左右並排比較大,在高的螢幕上上下疊比較大;室內四格多半是 2×2。
 * 以前寫死(室外上下疊),1280×720 的筆電上每格只剩 174×98,左右空了一大片。
 */
function useBestCols(n: number, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState<number | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || n < 1) return;
    const GAP = 12; // gap-3
    const CAPTION = 24; // 底下名稱那一行(1.5rem)
    const measure = () => {
      const { width: W, height: H } = el.getBoundingClientRect();
      let pick = 1;
      let size = 0;
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const cw = (W - (c - 1) * GAP) / c;
        const ch = (H - (r - 1) * GAP) / r - CAPTION;
        const w = Math.min(cw, (ch * 16) / 9);
        if (w > size + 0.5) {
          size = w;
          pick = c;
        }
      }
      setCols(pick);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [n, enabled]);
  return { ref, cols };
}

/**
 * 依可用寬度排影像格,但整組高度不超過 budget 元素高度的 share:
 * 試每一種欄數,算出 16:9 格子在「寬度放得下」與「高度不超過上限」下最大能多大,挑最大的。
 * 回傳欄數與每格寬度(px);框的高度就是格子本身,不會留一大塊空(以前撐滿固定高度)。
 */
type SizedBudget = {
  /** 以哪個元素的高度為準(左欄) */
  budget: RefObject<HTMLElement | null>;
  /** 最多佔它的幾成 */
  share: number;
  /** 同一欄裡其他固定高度的元素(數值卡那一列)—— 扣掉它與 reserveExtra 之後才是影像能用的上限 */
  reserve?: RefObject<HTMLElement | null>;
  reserveExtra?: number;
};

function useSizedGrid(n: number, sized?: SizedBudget) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ cols: number; tile: number } | null>(null);
  const share = sized?.share ?? 0;
  const budget = sized?.budget;
  const reserve = sized?.reserve;
  const reserveExtra = sized?.reserveExtra ?? 0;
  useEffect(() => {
    const el = ref.current;
    const box = budget?.current;
    if (!el || !box || n < 1) return;
    const GAP = 12; // gap-3
    const CAPTION = 24; // 底下名稱那一行
    const HEAD = 48; // 「影像」標題列 + 卡片內距
    const measure = () => {
      const W = el.getBoundingClientRect().width;
      const total = box.getBoundingClientRect().height;
      const others = (reserve?.current?.getBoundingClientRect().height ?? 0) + reserveExtra + 16; // 16 = 欄內間距
      const H = Math.min(total * share, total - others) - HEAD;
      let pick = { cols: 1, tile: 0 };
      for (let c = 1; c <= n; c++) {
        const r = Math.ceil(n / c);
        const byW = (W - (c - 1) * GAP) / c;
        const byH = (((H - (r - 1) * GAP) / r - CAPTION) * 16) / 9;
        const tile = Math.floor(Math.max(0, Math.min(byW, byH)));
        if (tile > pick.tile) pick = { cols: c, tile };
      }
      setFit(pick.tile > 0 ? pick : null);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(box);
    if (reserve?.current) ro.observe(reserve.current);
    return () => ro.disconnect();
  }, [n, share, budget, reserve, reserveExtra]);
  return { ref, cols: fit?.cols ?? null, tile: fit?.tile ?? 0 };
}

/** 即時一格:有串流就播(MJPEG),還沒有來源(車載名額滿 / 載具不通)就轉圈 */
function FieldLiveTile({ src, alt }: { src: string | null; alt: string }) {
  const spinner = <span className="video-spinner !h-8 !w-8 !border-[3px]" />;
  if (!src)
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black" role="status" aria-label="等待影像">
        {spinner}
        <VideoBadge kind="live" />
      </div>
    );
  return <FieldMjpegVideo src={src} alt={alt} badge={<VideoBadge kind="live" />} spinner={spinner} />;
}

// ── 測試數據 ─────────────────────────────────────────────────────────

/** /field 只放下行一張(依現場要求;中牆仍是上行、下行各一張),比兩趟的平均 */
const RATE_CHARTS: TrendSpec[] = [
  { label: "平均下行", unit: "kbps", metric: "dlKbps", digits: 0, kind: "rate" },
];
/** 橫軸刻度間隔(秒),同中牆:固定是它的整數倍 */
const X_TICK_S = 30;

function sampleSecond(pt: FieldSample | undefined): number | null {
  if (!pt) return null;
  return pt.elapsedS ?? pt.wall ?? null;
}

function CompareChart({ spec, runs, fill = false }: { spec: TrendSpec; runs: FieldRun[]; fill?: boolean }) {
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
    <div className={cn("min-w-0", fill && "flex min-h-0 flex-col")}>
      <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-1", fill ? "mb-1" : "mb-2")}>
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
      <div className={fill ? "min-h-[80px] flex-1" : "h-44 sm:h-52"}>
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
