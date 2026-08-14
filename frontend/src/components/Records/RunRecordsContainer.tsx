"use client";
import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import {
  useRicRunHistory,
  useRicRunResults,
  useRicRunProbeLogs,
  type RicRun,
} from "@/hooks/Backend/useRicRunHistory";

const PAGE_SIZE = 12;
const DETAIL_CASE_SIZE = 6;

function fmtTime(iso: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("zh-TW", { hour12: false });
  } catch {
    return iso;
  }
}

export function RunRecordsContainer() {
  const { groups, isLoading } = useRicRunHistory();
  const [selectedDut, setSelectedDut] = useState<string | null>(null);
  const [openRun, setOpenRun] = useState<RicRun | null>(null);
  const [page, setPage] = useState(0);

  // 預設選第一個 DUT 群組
  const activeDut = selectedDut ?? groups[0]?.dutName ?? null;
  const activeGroup = groups.find((g) => g.dutName === activeDut);
  const runs = activeGroup?.runs ?? [];
  const totalPages = Math.max(1, Math.ceil(runs.length / PAGE_SIZE));
  const pageRuns = runs.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  useEffect(() => {
    setPage(0);
    setOpenRun(null);
  }, [activeDut]);

  // 點開的 run → 抓逐案結果(展開在中牆卡片下方)
  const { results } = useRicRunResults(openRun?.run_uuid ?? null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 text-white">
      <h1 className="text-3xl font-bold tracking-widest">測試紀錄</h1>

      {/* DUT 分組切換(看單一 run 明細時隱藏,讓內容上移)*/}
      {!openRun && (
      <div className="flex flex-wrap gap-2">
        {groups.map((g) => (
          <button
            key={g.dutName}
            onClick={() => {
              setSelectedDut(g.dutName);
              setOpenRun(null);
            }}
            className={`rounded-item border px-4 py-2 text-base transition-colors ${
              g.dutName === activeDut
                ? "border-emerald-400/50 bg-emerald-400/[0.1] text-emerald-300"
                : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.07]"
            }`}
          >
            {g.dutName}
            <span className="ml-2 text-sm text-white/40">{g.runs.length} 次</span>
          </button>
        ))}
      </div>
      )}

      {/* openRun:切換成該次逐案結果(中牆同畫面),否則顯示 run 格狀清單 */}
      {openRun ? (
        <RunDetailView run={openRun} results={results} onBack={() => setOpenRun(null)} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          {isLoading ? (
            <div className="p-4 text-white/40">載入中…</div>
          ) : runs.length === 0 ? (
            <div className="p-4 text-white/40">此受測物尚無測試紀錄</div>
          ) : (
            <>
            <div className="rec-grid grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden xl:grid-cols-3">
              {pageRuns.map((r) => {
                const passed = Number(r.run_passed || 0);
                const failed = Number(r.run_failed || 0);
                const total = Number(r.run_total || 0);
                const allPass = total > 0 && failed === 0;
                return (
                  <div
                    key={r.run_uuid}
                    role="button"
                    onClick={() => setOpenRun(r)}
                    className="flex cursor-pointer flex-col rounded-item border border-white/10 bg-white/[0.03] px-6 py-3 text-left transition-colors hover:bg-white/[0.06]"
                  >
                    {/* 靠左排,右緣不放東西,避開 TV 框線 */}
                    <div className="flex items-center gap-2">
                      {allPass ? (
                        <CheckCircle2 className="h-7 w-7 flex-none text-emerald-400" />
                      ) : (
                        <XCircle className="h-7 w-7 flex-none text-rose-400" />
                      )}
                      <span className="min-w-0 truncate text-base">{r.scenarioName}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-sm">
                      <span className="text-white/50">{fmtTime(r.run_started_at)}</span>
                      <span className="tabular-nums">
                        <span className="text-emerald-400">{passed}</span>
                        {failed > 0 && <span className="text-rose-400"> / 失敗 {failed}</span>}
                        <span className="text-white/40"> / {total}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
              {totalPages > 1 && (
                <div className="flex flex-none items-center justify-center gap-4 pt-2">
                  <button
                    className="rounded-item border border-white/15 px-3 py-1 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30"
                    disabled={page <= 0}
                    onClick={() => setPage(page - 1)}
                  >
                    ‹ 上一頁
                  </button>
                  <span className="text-sm text-white/50">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    className="rounded-item border border-white/15 px-3 py-1 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(page + 1)}
                  >
                    下一頁 ›
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// 中牆:某次 run 的逐案結果(多欄格 + 返回),取代原本丟右牆的做法
function RunDetailView({
  run,
  results,
  onBack,
}: {
  run: RicRun;
  results: {
    result_uuid: string;
    result_verdict: string;
    result_detail: string;
    result_spec_ref: string;
    result_criteria_snapshot: string;
  }[];
  onBack: () => void;
}) {
  const { logs } = useRicRunProbeLogs(run.run_uuid);
  const [casePage, setCasePage] = useState(0);
  const totalCasePages = Math.max(1, Math.ceil(results.length / DETAIL_CASE_SIZE));
  const safeCasePage = Math.min(casePage, totalCasePages - 1);
  const pageResults = results.slice(
    safeCasePage * DETAIL_CASE_SIZE,
    (safeCasePage + 1) * DETAIL_CASE_SIZE,
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 text-white">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xl font-semibold">{run.scenarioName}</div>
          <div className="text-sm text-white/40">
            {fmtTime(run.run_started_at)} · 通過 {run.run_passed} / 共 {run.run_total}
          </div>
        </div>
        <button
          onClick={onBack}
          className="flex-none rounded-item border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          ‹ 返回列表
        </button>
      </div>
      {/* 左:逐案結果(換頁)| 右:探針日誌 */}
      <div className="rec-detail-body flex min-h-0 flex-1 gap-3">
      <div className="rec-cases-col flex min-h-0 flex-1 flex-col">
      <div className="rec-cases grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-hidden xl:grid-cols-3">
        {results.length === 0 ? (
          <div className="text-white/40">無逐案資料</div>
        ) : (
          pageResults.map((c) => {
            const pass = c.result_verdict === "pass";
            return (
              <div
                key={c.result_uuid}
                className="flex flex-col rounded-item border border-white/10 bg-white/[0.03] px-6 py-2"
              >
                <div className="flex items-center gap-2">
                  {pass ? (
                    <CheckCircle2 className="h-6 w-6 flex-none text-emerald-400" />
                  ) : (
                    <XCircle className="h-6 w-6 flex-none text-rose-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {c.result_spec_ref || "—"}
                  </span>
                </div>
                {c.result_criteria_snapshot && (
                  <div className="mt-1 truncate text-xs text-emerald-300/80">
                    通過條件:{c.result_criteria_snapshot}
                  </div>
                )}
                {c.result_detail && (
                  <div className="mt-0.5 line-clamp-2 text-xs text-white/60">
                    {c.result_detail}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      {totalCasePages > 1 && (
        <div className="flex flex-none items-center justify-center gap-4 pt-2">
          <button
            className="rounded-item border border-white/15 px-3 py-1 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30"
            disabled={safeCasePage <= 0}
            onClick={() => setCasePage(safeCasePage - 1)}
          >
            ‹ 上一頁
          </button>
          <span className="text-sm text-white/50">
            {safeCasePage + 1} / {totalCasePages}
          </span>
          <button
            className="rounded-item border border-white/15 px-3 py-1 text-sm text-white/70 hover:bg-white/10 disabled:opacity-30"
            disabled={safeCasePage >= totalCasePages - 1}
            onClick={() => setCasePage(safeCasePage + 1)}
          >
            下一頁 ›
          </button>
        </div>
      )}
      </div>
      {/* 右:本次探針原始 stdout */}
      <div className="rec-log flex min-h-0 w-[24rem] flex-none">
        <ProbeLogBox logs={logs} />
      </div>
      </div>
    </div>
  );
}

// 探針日誌終端機框(某次 run 的原始 stdout,可能多介面)
function ProbeLogBox({
  logs,
}: {
  logs: { log_uuid: string; probe_iface: string; probe_endpoint: string; log_text: string }[];
}) {
  return (
    <div className="flex h-full w-full min-h-0 flex-col overflow-hidden rounded-item border border-white/15 bg-black/70">
      <div className="flex flex-none items-center gap-2 border-b border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="ml-1 font-mono">探針日誌</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-sm leading-relaxed text-emerald-300/90">
        {logs.length === 0 ? (
          <span className="text-white/40">$ 本次無探針日誌</span>
        ) : (
          logs.map((l) => (
            <div key={l.log_uuid}>
              <div className="text-white/40">
                ── {l.probe_iface.toUpperCase()} · {l.probe_endpoint} ──
              </div>
              {l.log_text?.trimEnd()}
              {"\n"}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
