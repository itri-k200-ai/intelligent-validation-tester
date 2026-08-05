"use client";
import { Maximize2, Pause, Play, Video, Volume2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { selectionService } from "@/services";
import { adapterService } from "@/services/Adapter/adapterService";
import type { WallAdapterView } from "@/hooks/Adapter/useWallAdapterView";
import { useAdapterRun, type RunItemState } from "@/hooks/Adapter/useAdapterRun";
import { useRicCameras } from "@/hooks/Backend/useRicCameras";
import { useRicDutDetail } from "@/hooks/Backend/useRicDutDetail";
import { useRicTestcaseCatalog } from "@/hooks/Backend/useRicTestcaseCatalog";
import { HlsPlayer } from "@/components/Site/HlsPlayer";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";

// ── 中牆三帶:即時環境影像 | 測試過程 | 測試結果 ─────────────────────────
// 中牆 = 動態戰情(跑什麼、結果如何);測項清單(靜態)在右牆。
// 執行鈕在「測試過程」帶(左螢幕只負責選擇),按下 → adapter drive →
// 廣播 runnings(其他分頁)+ 更新本分頁 store → 輪詢顯示。
export function DutAdapterWallBands({ view }: { view: WallAdapterView }) {
  const run = useAdapterRun();
  const { cameras } = useRicCameras();
  const { catalog } = useRicTestcaseCatalog();
  const wallSel = useWallSelectionStore((s) => s.selection);
  const setWallSelection = useWallSelectionStore((s) => s.setSelection);
  const [driving, setDriving] = useState(false);
  const [driveErr, setDriveErr] = useState<string | null>(null);
  const [procPage, setProcPage] = useState(0);
  const [resPage, setResPage] = useState(0);

  const runTest = async () => {
    if (driving || view.testcases.length === 0) return;
    setDriving(true);
    setDriveErr(null);
    try {
      const runnings = await adapterService.drive(view.testcases.map((tc) => tc.testcaseId));
      const payload = {
        ...(wallSel ?? {}),
        runnings,
        runStartedAt: new Date().toISOString(),
      };
      // BroadcastChannel 不會回送給自己 → 本分頁手動更新 store,其他分頁走廣播。
      await selectionService.setSelection(payload).catch(() => {});
      setWallSelection(payload);
    } catch (e) {
      setDriveErr(e instanceof Error ? e.message : String(e));
    } finally {
      setDriving(false);
    }
  };
  // runningId → 測項名稱(顯示用)
  const nameById = new Map(view.testcases.map((tc) => [tc.testcaseId, tc.testcaseName]));
  const finished = run.items.filter(
    (i) => i.status === "finished" || i.status === "error",
  ).length;

  // 過程清單:執行前就先列出本次會跑的測項(未執行),執行後接輪詢狀態。
  const procItems: ProcItem[] = run.active
    ? run.items.map((i) => ({
        key: i.runningId || i.testcaseId,
        name: nameById.get(i.testcaseId) ?? i.testcaseId,
        status: i.status,
        progress: i.progress,
      }))
    : view.testcases.map((tc) => ({
        key: tc.testcaseId,
        name: tc.testcaseName,
        status: "idle" as const,
        progress: null,
      }));

  const totalProcPages = Math.max(1, Math.ceil(procItems.length / PAGE_SIZE));
  const pagedProc = procItems.slice(procPage * PAGE_SIZE, (procPage + 1) * PAGE_SIZE);
  const totalResPages = Math.max(1, Math.ceil(run.items.length / RES_PAGE_SIZE));
  const pagedResults = run.items.slice(
    resPage * RES_PAGE_SIZE,
    (resPage + 1) * RES_PAGE_SIZE,
  );

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

  // 執行中自動翻到目前項目那一頁
  const runningIdx = run.items.findIndex((i) => i.status === "running");
  useEffect(() => {
    if (run.active && runningIdx >= 0) setProcPage(Math.floor(runningIdx / PAGE_SIZE));
  }, [run.active, runningIdx]);

  // 換 DUT / 介面時回到第一頁
  useEffect(() => {
    setProcPage(0);
    setResPage(0);
  }, [view.dutName, view.interface]);

  return (
    <div className="dut-wall-bands">
      {/* 左帶:即時環境影像(位置不動;來源 = RICtester cameras + mediamtx HLS)*/}
      <div className="dut-wall-band dut-wall-band--env">
        <div className="dut-wall-band-title">
          即時環境影像{cameras[0] ? ` — ${cameras[0].camera_name}` : ""}
        </div>
        <div className="dut-wall-band-body">
          {cameras[0] ? (
            <HlsPlayer src={`/hls/${cameras[0].camera_uuid}/index.m3u8`} />
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

      {/* 右側兩帶:過程 | 結果 */}
      <div className="dut-wall-band dut-wall-band--status dut-wall-band--merged">
        <div className="dut-wall-band-split">
          {/* 測試過程:執行前就列出本次會跑的測項;執行鈕在右上角 */}
          <section>
            <div className="dut-wall-band-title flex items-center justify-between gap-3">
              <span>
                測試過程
                {run.active ? `（${finished}/${run.items.length} 完成）` : ""}
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
            <div className="dut-wall-band-body">
              <div className="flex h-full flex-col">
                <div className="flex-1 space-y-2 p-1">
                  {pagedProc.map((i) => (
                    <div
                      key={i.key}
                      className="flex items-center gap-3 rounded-item border border-white/10 px-3 py-2"
                    >
                      <StatusDot status={i.status} />
                      <span className="font-mono text-sm">{i.name}</span>
                      <span className="min-w-0 truncate text-xs text-white/40">
                        {catalog.get(i.name)?.testcase_procedure}
                      </span>
                      <span className="ml-auto flex-none text-xs text-white/50">
                        {i.status === "running" && i.progress != null
                          ? `${i.progress}%`
                          : STATUS_LABEL[i.status]}
                      </span>
                    </div>
                  ))}
                </div>
                <Pager page={procPage} total={totalProcPages} onChange={setProcPage} />
              </div>
            </div>
          </section>

          {/* 測試結果 */}
          <section>
            <div className="dut-wall-band-title">
              測試結果
              {run.active
                ? ` — 通過 ${run.passed} / 失敗 ${run.failed} / 共 ${run.items.length}`
                : ""}
            </div>
            <div className="dut-wall-band-body">
              {!run.active ? (
                <p className="p-2 text-sm text-white/40">執行後顯示逐項判決</p>
              ) : (
                <div className="flex h-full flex-col">
                  <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-1">
                    {pagedResults.map((i) => {
                      const code = nameById.get(i.testcaseId) ?? i.testcaseId;
                      const cat = catalog.get(code);
                      return (
                        <div
                          key={i.runningId || i.testcaseId}
                          className="rounded-item border border-white/10 bg-white/[0.03] px-3 py-2"
                        >
                          {/* 測項代碼 + 程序名 + 判決 */}
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">{code}</span>
                            <span className="truncate text-xs text-white/50">
                              {cat?.testcase_procedure}
                            </span>
                            <span className="ml-auto flex-none">
                              <VerdictPill item={i} />
                            </span>
                          </div>
                          {/* 這項在驗什麼(型錄中文通過條件) */}
                          {cat?.testcase_pass_criteria && (
                            <div className="mt-0.5 truncate text-xs text-emerald-300/80">
                              通過條件:{cat.testcase_pass_criteria}
                            </div>
                          )}
                          {/* 本次執行的結果說明(失敗原因) */}
                          {i.resultDescription && (
                            <div className="mt-0.5 text-xs text-white/60">
                              結果:{i.resultDescription}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-auto">
                    <Pager page={resPage} total={totalResPages} onChange={setResPage} />
                  </div>
                </div>
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

// 每頁顯示的測項數(清單超過就出現上/下頁)
const PAGE_SIZE = 7;
// 結果卡片含通過條件/說明三行,每頁少一點
const RES_PAGE_SIZE = 5;
// 右牆各介面統計的顯示順序
const SLOT_IFACE_ORDER = ["E2", "A1", "O1"];

type ProcStatus = RunItemState["status"] | "idle";
type ProcItem = {
  key: string;
  name: string;
  status: ProcStatus;
  progress: number | null;
};

const STATUS_LABEL: Record<ProcStatus, string> = {
  idle: "未執行",
  pending: "等待中",
  running: "執行中",
  finished: "完成",
  error: "錯誤",
};

function StatusDot({ status }: { status: ProcStatus }) {
  const cls =
    status === "finished"
      ? "bg-emerald-400"
      : status === "running"
        ? "bg-sky-400 animate-pulse"
        : status === "error"
          ? "bg-rose-400"
          : "bg-zinc-500";
  return <span className={`inline-block h-2.5 w-2.5 flex-none rounded-full ${cls}`} />;
}

function VerdictPill({ item }: { item: RunItemState }) {
  if (item.result === "passed")
    return <span className="result-pill result-pill--pass">通過</span>;
  if (item.result === "failed" || item.result === "error")
    return <span className="result-pill result-pill--fail">失敗</span>;
  return <span className="result-pill">—</span>;
}

// ── 右牆三格:受測物明細 | 介面連線 | 測試項目清單(靜態)──────────────────
// 右牆 = DUT 整體檔案:換介面「不」跟著變(介面層級的內容歸中牆),
// 只用當前介面做視覺高亮,避免與中牆重複。
export function useAdapterDutInfoSlots(view: WallAdapterView) {
  const { dutName, interface: iface, allTestcases, scenarios } = view;
  const { detail } = useRicDutDetail(dutName);
  const dut = detail.dut;
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
        <div className="text-3xl font-semibold">{dut?.dut_name ?? dutName ?? "—"}</div>
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
        {/* 各介面測項數;當前介面高亮 */}
        <div className="flex flex-wrap gap-2">
          {ifaceSummary.map(([name, count]) => {
            const isCurrent = !!iface && name === iface.toUpperCase();
            return (
              <div
                key={name}
                className={`rounded-item border px-3 py-1.5 text-sm ${
                  isCurrent
                    ? "border-emerald-400/50 bg-emerald-400/[0.08] text-emerald-300"
                    : "border-white/10 bg-white/[0.03] text-white/80"
                }`}
              >
                {name} · {count} 項
              </div>
            );
          })}
        </div>
        {/* 案例集清單 */}
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
      </div>
    ),
  };
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-0.5">{value || <span className="text-white/40">—</span>}</div>
    </div>
  );
}
