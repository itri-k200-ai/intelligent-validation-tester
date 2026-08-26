"use client";
import { CheckCircle2, Maximize2, Pause, Play, Terminal, Video, Volume2, XCircle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { adapterService } from "@/services/Adapter/adapterService";
import type { WallAdapterView } from "@/hooks/Adapter/useWallAdapterView";
import { useAdapterRun, type RunItemState } from "@/hooks/Adapter/useAdapterRun";
import { useIvtCameras } from "@/hooks/Backend/useIvtCameras";
import { useRicDutDetail } from "@/hooks/Backend/useRicDutDetail";
import { useRicProbeLog, type RicProbeLog } from "@/hooks/Backend/useRicProbeLog";
import { ricBackend } from "@/services/Backend/ricBackendService";
import { useRicTestcaseCatalog } from "@/hooks/Backend/useRicTestcaseCatalog";
import { HlsPlayer } from "@/components/Site/HlsPlayer";
import { runKey, useWallRunStore } from "@/stores/wallRunStore";
import { bi, pickLocale } from "@/lib/bilingual";
import { useLocale } from "@/stores/localeStore";
import { DEFAULT_RIC_SOURCE } from "@/config/ricSources";

// ── 中牆三帶:即時環境影像 | 測試過程 | 測試結果 ─────────────────────────
// 中牆 = 動態戰情(跑什麼、結果如何);測項清單(靜態)在右牆。
// 執行鈕在「測試過程」帶(左螢幕只負責選擇),按下 → adapter drive →
// 廣播 runnings(其他分頁)+ 更新本分頁 store → 輪詢顯示。
export function DutAdapterWallBands({ view }: { view: WallAdapterView }) {
  const run = useAdapterRun();
  const { cameras } = useIvtCameras();
  const { catalog } = useRicTestcaseCatalog();
  const setRun = useWallRunStore((s) => s.setRun);
  const [driving, setDriving] = useState(false);
  const [driveErr, setDriveErr] = useState<string | null>(null);
  const [resPage, setResPage] = useState(0);
  // 測試項目清單:量測可用高度 + 最高列高 → 動態算每頁項數(換頁,不捲動)。
  // 執行中列變高(多了結果說明)時,每頁自動變少、出現換頁。
  const listRef = useRef<HTMLDivElement>(null);
  const [pageSize, setPageSize] = useState(ITEM_PAGE_SIZE);
  // 探針原始 stdout:選了介面 → 該介面端點;沒選 → 該 DUT 全部端點。
  const { detail } = useRicDutDetail(view.dutName);
  const ifaceEndpoint = detail.endpoints.find(
    (e) => e.dut_endpoint_interface === (view.interface ?? "").toLowerCase(),
  )?.dut_endpoint_address;
  const probeEndpoints = ifaceEndpoint
    ? [ifaceEndpoint]
    : detail.endpoints.map((e) => e.dut_endpoint_address);
  // 探針 log:run.active 才顯示(執行前空);只顯示「本次執行後才出現」的新 log
  // —— 用執行當下記下的基準 uuid 分辨,不靠時鐘。
  const { log: probeLog } = useRicProbeLog(probeEndpoints, {
    enabled: run.active,
    baselineUuid: run.baselineLogUuid,
  });

  const runTest = async () => {
    if (driving || view.testcases.length === 0) return;
    setDriving(true);
    setDriveErr(null);
    try {
      // 執行前先記下該端點既有最新 log 的 uuid,作為「只顯示本次新 log」的基準
      let baselineLogUuid: string | null = null;
      try {
        const rows = (await ricBackend.probeLogs({})) as RicProbeLog[];
        const wanted = new Set(probeEndpoints);
        const prev = rows
          .filter((r) => wanted.has(r.probe_endpoint))
          .sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1))[0];
        baselineLogUuid = prev?.log_uuid ?? null;
      } catch {
        /* 拿不到就當沒有基準 */
      }
      const runnings = await adapterService.drive(
        view.source ?? DEFAULT_RIC_SOURCE,
        view.testcases.map((tc) => tc.testcaseId),
      );
      // run 狀態依「DUT+介面」保存,跟選擇導覽脫鉤:切走再切回仍看得到。
      setRun(runKey(view.dutName, view.interface), {
        runnings,
        startedAt: new Date().toISOString(),
        baselineLogUuid,
      });
    } catch (e) {
      setDriveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDriving(false);
    }
  };
  // runningId → 測項名稱(顯示用)
  const nameById = new Map(view.testcases.map((tc) => [tc.testcaseId, tc.testcaseName]));

  // 測試項目清單:執行前先列出本次要測的項目(未執行),執行後同一份接上
  // 各項的狀態 / 進度 / 通過判決。
  const itemRows: ItemRow[] = run.active
    ? run.items.map((i) => ({
        key: i.runningId || i.testcaseId,
        code: nameById.get(i.testcaseId) ?? i.testcaseId,
        status: i.status,
        progress: i.progress,
        result: i.result,
        resultDescription: i.resultDescription,
      }))
    : view.testcases.map((tc) => ({
        key: tc.testcaseId,
        code: tc.testcaseName,
        status: "idle" as const,
        progress: null,
        result: null,
        resultDescription: "",
      }));
  const totalItemPages = Math.max(1, Math.ceil(itemRows.length / pageSize));
  const safePage = Math.min(resPage, totalItemPages - 1);
  const pagedItems = itemRows.slice(safePage * pageSize, (safePage + 1) * pageSize);

  // 依可用高度與實際列高,動態決定每頁項數(換頁而非捲動)。列高在執行中
  // 會變高(多了結果說明),量測後每頁自動變少。
  const fitPageSize = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const rows = Array.from(el.children) as HTMLElement[];
    if (rows.length === 0) return;
    const gap = 8; // space-y-2 = 0.5rem
    const maxRow = Math.max(...rows.map((r) => r.offsetHeight)) + gap;
    const fit = Math.max(1, Math.floor((el.clientHeight + gap) / maxRow));
    setPageSize((prev) => (prev === fit ? prev : fit));
  }, []);
  // 內容變動(執行中列高變化)時重新量測
  useEffect(() => {
    fitPageSize();
  }, [itemRows, fitPageSize]);
  // 容器尺寸變動(視窗 / 牆模式)時重新量測
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => fitPageSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitPageSize]);
  // 頁數變少時把當前頁夾回範圍
  useEffect(() => {
    if (resPage > totalItemPages - 1) setResPage(totalItemPages - 1);
  }, [totalItemPages, resPage]);

  // 整體進度:完成/錯誤算 100%,執行中算該項 progress
  const overallPct =
    run.active && run.items.length
      ? Math.round(
          run.items.reduce(
            (s, i) =>
              s +
              (i.status === "finished" || i.status === "error"
                ? 100
                : i.status === "running"
                  ? (i.progress ?? 0)
                  : 0),
            0,
          ) / run.items.length,
        )
      : 0;

  // 換 DUT / 介面時回到第一頁
  useEffect(() => {
    setResPage(0);
  }, [view.dutName, view.interface]);

  return (
    <div className="dut-wall-bands">
      {/* 左帶:即時環境影像(位置不動;來源 = RICtester cameras + mediamtx HLS)*/}
      <div className="dut-wall-band dut-wall-band--env">
        <div className="dut-wall-band-title">
          即時環境影像{cameras[0] ? ` — ${cameras[0].name}` : ""}
        </div>
        <div className="dut-wall-band-body">
          {cameras[0]?.hls_url ? (
            <HlsPlayer src={cameras[0].hls_url} />
          ) : (
            <div className="video-placeholder">
              <div className="video-screen">
                <div className="video-empty">
                  <Video className="w-20 h-20" strokeWidth={1.25} />
                  <p>尚無攝影機串流</p>
                </div>
                <div className="video-live-badge">
                  <span className="video-live-dot" /> LIVE
                </div>
              </div>
              <div className="video-controls">
                <button type="button" aria-label="play"><Play className="w-5 h-5" /></button>
                <button type="button" aria-label="pause"><Pause className="w-5 h-5" /></button>
                <span className="video-time">00:00</span>
                <div className="video-timeline"><div className="video-progress" /></div>
                <span className="video-time">--:--</span>
                <button type="button" aria-label="volume"><Volume2 className="w-5 h-5" /></button>
                <button type="button" aria-label="fullscreen"><Maximize2 className="w-5 h-5" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右側兩帶:測試結果 | 探針日誌 */}
      <div className="dut-wall-band dut-wall-band--status dut-wall-band--merged">
        <div className="dut-wall-band-split">
          {/* 測試項目:執行前列出待測項;執行後同一份接上狀態/進度/判決 */}
          <section>
            <div className="dut-wall-band-title flex items-center justify-between gap-3">
              <span>
                測試項目
                {run.active
                  ? ` — 通過 ${run.passed} / 失敗 ${run.failed} / 共 ${run.items.length}`
                  : ` — 共 ${view.testcases.length} 項`}
              </span>
              <button
                onClick={runTest}
                disabled={driving || view.testcases.length === 0 || (run.active && !run.done)}
                className={`rounded-item px-4 py-1.5 text-sm font-bold tracking-widest transition-colors ${
                  driving || (run.active && !run.done)
                    ? "cursor-wait bg-white/10 text-white/40"
                    : "bg-emerald-500/90 text-[#06281c] hover:bg-emerald-400"
                }`}
              >
                {driving
                  ? "啟動中…"
                  : run.active && !run.done
                    ? "執行中…"
                    : run.done
                      ? "↻ 重新執行"
                      : "▶ 執行測試"}
              </button>
            </div>
            {/* 整體進度條 */}
            <div className="mb-2 px-1">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-white/50">
                <span>
                  {run.active
                    ? `整體進度 ${overallPct}%`
                    : `本次將執行 ${view.testcases.length} 項`}
                </span>
                {run.startedAt && (
                  <span>起跑:{new Date(run.startedAt).toLocaleTimeString()}</span>
                )}
              </div>
              {driveErr && <p className="mt-1 text-sm text-rose-400">驅動失敗:{driveErr}</p>}
            </div>
            <div className="dut-wall-band-body min-h-0">
              {itemRows.length === 0 ? (
                <p className="p-2 text-sm text-white/40">此介面尚無測試項目</p>
              ) : (
                <div className="flex h-full min-h-0 flex-col">
                  <div ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-hidden p-1">
                    {pagedItems.map((it) => {
                      const cat = catalog.get(it.code);
                      return (
                        <div
                          key={it.key}
                          className="rounded-item border border-white/10 bg-white/[0.03] px-3 py-2"
                        >
                          {/* 狀態燈 + 測項代碼 + 程序名 + 進度/判決 */}
                          <div className="flex items-center gap-2">
                            <StatusDot status={it.status} result={it.result} />
                            <span className="font-mono text-sm">{it.code}</span>
                            <span className="min-w-0 truncate text-xs text-white/50">
                              {cat?.testcase_procedure}
                            </span>
                            <span className="ml-auto flex-none">
                              {it.result ? (
                                <VerdictPill result={it.result} />
                              ) : (
                                <span className="text-sm text-white/50">
                                  {STATUS_LABEL[it.status]}
                                </span>
                              )}
                            </span>
                          </div>
                          {/* 這項在驗什麼(型錄中文通過條件) */}
                          {cat?.testcase_pass_criteria && (
                            <div className="mt-0.5 truncate text-xs text-emerald-300/80">
                              通過條件:{cat.testcase_pass_criteria}
                            </div>
                          )}
                          {/* 執行後的結果說明(失敗原因)*/}
                          {it.resultDescription && (
                            <div className="mt-0.5 text-xs text-white/60">
                              結果:{it.resultDescription}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex-none">
                    <Pager page={safePage} total={totalItemPages} onChange={setResPage} />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 探針日誌:執行後才顯示,只採用本次 run 的原始 stdout(執行前清空)*/}
          <section>
            <div className="dut-wall-band-title">執行紀錄</div>
            <div className="dut-wall-band-body min-h-0">
              {run.active ? (
                <div className="h-full min-h-0 w-full">
                  <ProbeConsole
                    log={probeLog}
                    iface={view.interface}
                    endpoint={ifaceEndpoint}
                  />
                </div>
              ) : (
                <p className="p-2 text-sm text-white/40">執行後顯示探針輸出</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// 上/下頁切換(清單超出一頁時顯示)
function Pager({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  if (total <= 1) return null;
  const btn =
    "rounded-item border border-white/15 px-3 py-1 text-sm text-white/70 " +
    "hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      <button className={btn} disabled={page <= 0} onClick={() => onChange(page - 1)}>
        ‹ 上一頁
      </button>
      <span className="text-sm text-white/50">
        {page + 1} / {total}
      </span>
      <button
        className={btn}
        disabled={page >= total - 1}
        onClick={() => onChange(page + 1)}
      >
        下一頁 ›
      </button>
    </div>
  );
}

// 測試項目卡片含通過條件/結果說明多行,每頁 5 項留空間給分頁列
const ITEM_PAGE_SIZE = 5;
// 右牆各介面統計的顯示順序
const SLOT_IFACE_ORDER = ["E2", "A1", "O1"];
// 右牆「測試能力」展開清單:每頁測項數
const EXPAND_PAGE_SIZE = 6;

// 測試項目清單一列(執行前=idle 待測,執行後=帶狀態/進度/判決)
type ItemStatus = RunItemState["status"] | "idle";
type ItemRow = {
  key: string;
  code: string;
  status: ItemStatus;
  progress: number | null;
  result: RunItemState["result"];
  resultDescription: string;
};

const STATUS_LABEL: Record<ItemStatus, string> = {
  idle: "未執行",
  pending: "等待中",
  running: "執行中",
  finished: "完成",
  error: "錯誤",
};

// 狀態燈:有判決時依 pass/fail 上色,否則依執行狀態
function StatusDot({
  status,
  result,
}: {
  status: ItemStatus;
  result?: RunItemState["result"];
}) {
  const cls =
    result === "passed"
      ? "bg-emerald-400"
      : result === "failed" || result === "error"
        ? "bg-rose-400"
        : status === "finished"
          ? "bg-emerald-400"
          : status === "running"
            ? "bg-sky-400 animate-pulse"
            : status === "error"
              ? "bg-rose-400"
              : "bg-zinc-500";
  return <span className={`inline-block h-2.5 w-2.5 flex-none rounded-full ${cls}`} />;
}

function VerdictPill({ result }: { result: RunItemState["result"] }) {
  if (result === "passed")
    return (
      <span className="flex items-center gap-2 font-semibold text-emerald-400">
        <CheckCircle2 className="h-8 w-8" strokeWidth={2.2} />
        <span>通過</span>
      </span>
    );
  if (result === "failed" || result === "error")
    return (
      <span className="flex items-center gap-2 font-semibold text-rose-400">
        <XCircle className="h-8 w-8" strokeWidth={2.2} />
        <span>失敗</span>
      </span>
    );
  return <span className="text-2xl text-white/40">—</span>;
}

// ── 右牆三格:受測物明細 | 介面連線 | 測試項目清單(靜態)──────────────────
// 右牆 = DUT 整體檔案:換介面「不」跟著變(介面層級的內容歸中牆),
// 只用當前介面做視覺高亮,避免與中牆重複。
export function useAdapterDutInfoSlots(view: WallAdapterView) {
  const { dutName, interface: iface, allTestcases, scenarios } = view;
  const { detail } = useRicDutDetail(dutName);
  const dut = detail.dut;
  const locale = useLocale();
  // 右牆 DUT 標題:back_end 雙語(dut_name_en/_zh)優先,fallback adapter 識別碼
  const dutTitle = dut
    ? pickLocale(bi(dut.dut_name_en, dut.dut_name_zh || dut.dut_name), locale)
    : dutName;
  // 「測試能力」點開某介面 → 展開該介面的測項清單(分頁;再點收合)
  const [openIface, setOpenIface] = useState<string | null>(null);
  const [exPage, setExPage] = useState(0);
  useEffect(() => {
    setOpenIface(null);
  }, [dutName]);
  useEffect(() => {
    setExPage(0);
  }, [openIface]);
  const openList = openIface
    ? allTestcases.filter((tc) =>
        tc.testcaseName.toLowerCase().startsWith(openIface.toLowerCase() + "."),
      )
    : [];
  const totalExPages = Math.max(1, Math.ceil(openList.length / EXPAND_PAGE_SIZE));
  const pagedExList = openList.slice(
    exPage * EXPAND_PAGE_SIZE,
    (exPage + 1) * EXPAND_PAGE_SIZE,
  );
  // 全部介面端點(不過濾);選中的介面加高亮框
  const eps = detail.endpoints;
  // 各介面測項數(DUT 層級統計,依 E2/A1/O1 排序)
  const ifaceCounts = new Map<string, number>();
  allTestcases.forEach((tc) => {
    const p = (tc.testcaseName.split(".")[0] || "").toUpperCase();
    if (p) ifaceCounts.set(p, (ifaceCounts.get(p) ?? 0) + 1);
  });
  const ifaceSummary = [...ifaceCounts.entries()].sort(
    (a, b) =>
      (SLOT_IFACE_ORDER.indexOf(a[0]) + 1 || 99) -
      (SLOT_IFACE_ORDER.indexOf(b[0]) + 1 || 99),
  );

  return {
    dut: (
      <div className="flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden p-2 text-white">
        <div className="text-sm uppercase tracking-widest text-white/50">受測物</div>
        <div className="text-3xl font-semibold">{dutTitle ?? "—"}</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="類型" value={dut?.dut_kind} />
          <Field label="狀態" value={dut?.dut_status} />
          <Field label="產品" value={dut?.dut_product} />
          <Field label="版本" value={dut?.dut_version} />
        </div>
        {dut?.dut_description && (
          <div>
            <div className="text-xs text-white/60">描述</div>
            <div className="mt-1 text-sm">{dut.dut_description}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-white/60">E2 身分(gNB)</div>
          <div className="mt-1 font-mono text-xs">
            MCC {dut?.dut_mcc || "—"} / MNC {dut?.dut_mnc || "—"} / gNB {dut?.dut_gnb_id || "—"} / Cell {dut?.dut_cell_id || "—"}
          </div>
        </div>
      </div>
    ),
    equip: (
      <div className="flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden p-2 text-white">
        <div className="text-sm uppercase tracking-widest text-white/50">介面連線</div>
        {eps.length === 0 ? (
          <div className="text-white/40">尚無連線端點</div>
        ) : (
          <div className="space-y-2">
            {eps.map((e) => {
              const isCurrent =
                !!iface &&
                e.dut_endpoint_interface.toLowerCase() === iface.toLowerCase();
              return (
                <div
                  key={e.dut_endpoint_uuid}
                  className={`rounded-item border px-3 py-2 ${
                    isCurrent
                      ? "border-emerald-400/50 bg-emerald-400/[0.06]"
                      : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge tone="blue">{e.dut_endpoint_interface.toUpperCase()}</Badge>
                    <span className="text-xs text-white/50">{e.dut_endpoint_status}</span>
                    {isCurrent && (
                      <span className="ml-auto text-xs text-emerald-300/80">測試中介面</span>
                    )}
                  </div>
                  {/* 位址可折行,不撐爆格寬 */}
                  <div className="mt-1 break-all font-mono text-xs text-white/80">
                    {e.dut_endpoint_address}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    ),
    // 測試能力總覽(DUT 層級,換介面不變):各介面測項數 + 案例集。
    // 「當前介面的測項清單」歸中牆(測試過程),此格不重複。
    method: (
      <div className="flex h-full w-full min-w-0 flex-col gap-3 overflow-hidden p-2 text-white">
        <div className="text-sm uppercase tracking-widest text-white/50">
          測試能力（{allTestcases.length} 項）
        </div>
        {/* 各介面測項數;可點開展開該介面的測項清單;當前測試中介面高亮 */}
        <div className="flex flex-wrap gap-2">
          {ifaceSummary.map(([name, count]) => {
            const isCurrent = !!iface && name === iface.toUpperCase();
            const isOpen = openIface === name;
            return (
              <button
                key={name}
                onClick={() => setOpenIface(isOpen ? null : name)}
                className={`rounded-item border px-3 py-1.5 text-sm transition-colors ${
                  isOpen
                    ? "border-white/40 bg-white/10 text-white"
                    : isCurrent
                      ? "border-emerald-400/50 bg-emerald-400/[0.08] text-emerald-300"
                      : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]"
                }`}
              >
                {name} · {count} 項 {isOpen ? "▾" : "▸"}
              </button>
            );
          })}
        </div>
        {openIface ? (
          /* 展開:該介面的測項清單(分頁,正常字級);再點一次介面鈕收合 */
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="mb-1 text-xs text-white/40">
              {openIface} 測試項目(點上方 {openIface} 收合)
            </div>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
              {pagedExList.map((tc) => (
                <div
                  key={tc.testcaseId}
                  className="min-w-0 rounded-item border border-white/10 bg-white/[0.03] px-3 py-1.5"
                >
                  <span className="truncate font-mono text-sm text-white/85">
                    {tc.testcaseName}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-auto">
              <Pager page={exPage} total={totalExPages} onChange={setExPage} />
            </div>
          </div>
        ) : (
          /* 預設:案例集清單 */
          <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
            <div className="text-xs text-white/40">測試案例集</div>
            {scenarios.length === 0 ? (
              <div className="text-white/40">—</div>
            ) : (
              scenarios.map((s, i) => (
                <div
                  key={i}
                  className="min-w-0 rounded-item border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <div className="truncate text-sm text-white/85">{s.name}</div>
                  <div className="mt-0.5 text-xs text-white/40">{s.count} 個測項</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    ),
  };
}

// 終端機風格的探針日誌框：深色、等寬字、自動捲到底,像 command line 在跑。
function ProbeConsole({
  log,
  iface,
  endpoint,
}: {
  log: RicProbeLog | null;
  iface: string | null;
  endpoint?: string | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [log?.log_text]);
  const dot = "inline-block h-2.5 w-2.5 rounded-full";
  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-item border border-white/15 bg-black/70">
      {/* 標題列(仿終端機視窗)*/}
      <div className="flex flex-none items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
        <span className="flex items-center gap-1.5">
          <span className={`${dot} bg-rose-400/80`} />
          <span className={`${dot} bg-amber-400/80`} />
          <span className={`${dot} bg-emerald-400/80`} />
        </span>
        <Terminal className="ml-1 h-3.5 w-3.5" />
        <span className="font-mono">
          執行紀錄{iface ? ` · ${iface}` : ""}{endpoint ? ` · ${endpoint}` : ""}
        </span>
        {log?.captured_at && (
          <span className="ml-auto font-mono text-white/35">
            {new Date(log.captured_at).toLocaleTimeString()}
          </span>
        )}
      </div>
      {/* 內容 */}
      <div
        ref={ref}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-sm leading-relaxed text-emerald-300/90"
      >
        {log?.log_text?.trimEnd() || (
          <span className="text-white/40">$ 測試執行中,等待探針輸出…</span>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-0.5">{value || <span className="text-white/40">—</span>}</div>
    </div>
  );
}
