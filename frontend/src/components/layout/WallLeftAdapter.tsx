"use client";
import { useState } from "react";
import { FileText, History, Play, RefreshCw } from "lucide-react";

import {
  reportUrl,
  useAdapterCatalog,
  useAdapterHistory,
  useNotifyHisShow,
  useRunningStatus,
  useTriggerTest,
  type AdapterHistoryRow,
} from "@/hooks/Adapter/useAdapter";

/**
 * 左牆:Performance_tester adapter 的操作台。
 *
 * adapter 是外部團隊操作這套系統的唯一入口,左牆就是它的前台 —— 驅動測試、
 * 挑一筆歷史丟上中牆、下載報告。三件事對應 adapter 的三組端點(見 useAdapter)。
 *
 * 刻意不接「目錄管理」與 /autoTest/_seed(重建目錄會清資料)—— 那是改資料結構的
 * 操作,放在無人看管的牆上太危險,要用請走 adapter 自己的測試台。
 *
 * 驅動會讓載具真的動起來,所以按鈕做成兩段:按一下變成「確定要跑?」,
 * 3 秒內沒再按就自己取消,避免路過的人誤觸。
 */
export function WallLeftAdapter() {
  const catalog = useAdapterCatalog();
  const history = useAdapterHistory();
  const trigger = useTriggerTest();
  const notify = useNotifyHisShow();

  /** 這一輪由左牆驅動起來的 runningId —— 用來顯示進度 */
  const [started, setStarted] = useState<string[]>([]);
  const status = useRunningStatus(started);
  /** 等待二次確認的案例 */
  const [arming, setArming] = useState<string | null>(null);

  const armOrRun = (testcaseId: string) => {
    if (arming !== testcaseId) {
      setArming(testcaseId);
      window.setTimeout(() => setArming((cur) => (cur === testcaseId ? null : cur)), 3000);
      return;
    }
    setArming(null);
    trigger.mutate(testcaseId, {
      onSuccess: (rows) => {
        const ids = rows.map((r) => r.runningId).filter((v): v is string => !!v);
        if (ids.length) setStarted((cur) => [...new Set([...ids, ...cur])].slice(0, 5));
      },
    });
  };

  return (
    <div className="adapter-panel">
      <header className="adapter-head">
        <span className="adapter-title">驗測操作台</span>
        <button type="button" onClick={() => { catalog.refetch(); history.refetch(); }}>
          <RefreshCw /> 重新整理
        </button>
      </header>

      {/* ── 測試目錄:DUT → 情境 → 案例 ── */}
      <section className="adapter-sec">
        <h3>測試項目</h3>
        {catalog.isError && <p className="adapter-warn">連不上 adapter</p>}
        {(catalog.data ?? []).map((dut) => (
          <div key={dut.dutName_en ?? dut.dutName_zh ?? ""} className="adapter-dut">
            <div className="adapter-dut-name">{dut.dutName_zh || dut.dutName_en}</div>
            {dut.scenarioList.map((sc) => (
              <div key={sc.scenarioId} className="adapter-scenario">
                <div className="adapter-scenario-name">{sc.scenarioName_zh || sc.scenarioName_en}</div>
                {sc.testcaseList.map((tc) => (
                  <button
                    key={tc.testcaseId}
                    type="button"
                    className={`adapter-run ${arming === tc.testcaseId ? "is-arming" : ""}`}
                    onClick={() => armOrRun(tc.testcaseId)}
                    disabled={trigger.isPending}
                  >
                    <Play />
                    {arming === tc.testcaseId
                      ? "再按一次開始驗測"
                      : tc.testcaseName_zh || tc.testcaseName_en}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* ── 剛剛驅動的那幾筆 ── */}
      {started.length > 0 && (
        <section className="adapter-sec">
          <h3>執行中</h3>
          {started.map((id) => {
            const st = (status.data ?? []).find((s) => s.runningId === id);
            return (
              <div key={id} className="adapter-running">
                <span className="adapter-run-id">{id.slice(0, 8)}</span>
                <span className="adapter-run-state">{st?.status ?? "等待中"}</span>
                <div className="adapter-run-bar">
                  <div style={{ width: `${st?.progress ?? 0}%` }} />
                </div>
                <span className="adapter-run-pct">{Math.round(st?.progress ?? 0)}%</span>
              </div>
            );
          })}
        </section>
      )}

      {/* ── 歷史:點一筆就丟上中牆 ── */}
      <section className="adapter-sec adapter-sec--grow">
        <h3>
          <History /> 歷史驗測
        </h3>
        <div className="adapter-history">
          {(history.data ?? []).map((r) => (
            <HistoryRow key={r.runId} row={r} onShow={() => r.runningId && notify.mutate(r.runningId)} />
          ))}
          {history.isError && (
            <p className="adapter-warn">
              取不到歷史清單 —— adapter 向平台要資料失敗(平台端狀況,稍後會自己恢復)
            </p>
          )}
          {!history.isError && history.data?.length === 0 && (
            <p className="adapter-warn">還沒有紀錄</p>
          )}
        </div>
      </section>
    </div>
  );
}

function HistoryRow({ row, onShow }: { row: AdapterHistoryRow; onShow: () => void }) {
  const at = row.created
    ? new Date(row.created * 1000).toLocaleString("zh-TW", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
  return (
    <div className={`adapter-hrow ${row.notified ? "is-shown" : ""}`}>
      <span className="adapter-hrow-at">{at}</span>
      <span className="adapter-hrow-name">{row.testcaseName || row.planName || row.runId.slice(0, 8)}</span>
      <span className={`adapter-hrow-state s-${row.status ?? "unknown"}`}>{row.status ?? "—"}</span>
      <span className="adapter-hrow-n">{row.nSamples ?? 0} 筆{row.hasReplay ? " · 有回放" : ""}</span>
      <button type="button" onClick={onShow} disabled={!row.runningId}>
        顯示在中牆
      </button>
      {row.runningId && (
        <a href={reportUrl(row.runningId)} target="_blank" rel="noreferrer">
          <FileText /> 報告
        </a>
      )}
    </div>
  );
}
