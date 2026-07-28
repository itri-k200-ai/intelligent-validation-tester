"use client";
import { Maximize2, Pause, Play, Video, Volume2 } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { selectionService } from "@/services";
import { adapterService, type AdapterTestcase } from "@/services/Adapter/adapterService";
import type { WallAdapterView } from "@/hooks/Adapter/useWallAdapterView";
import { useAdapterRun, type RunItemState } from "@/hooks/Adapter/useAdapterRun";
import { useRicDutDetail } from "@/hooks/Backend/useRicDutDetail";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";

// ── 中牆三帶:即時環境影像 | 測試過程 | 測試結果 ─────────────────────────
// 中牆 = 動態戰情(跑什麼、結果如何);測項清單(靜態)在右牆。
// 執行鈕在「測試過程」帶(左螢幕只負責選擇),按下 → adapter drive →
// 廣播 runnings(其他分頁)+ 更新本分頁 store → 輪詢顯示。
export function DutAdapterWallBands({ view }: { view: WallAdapterView }) {
  const run = useAdapterRun();
  const wallSel = useWallSelectionStore((s) => s.selection);
  const setWallSelection = useWallSelectionStore((s) => s.setSelection);
  const [driving, setDriving] = useState(false);
  const [driveErr, setDriveErr] = useState<string | null>(null);

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

  return (
    <div className="dut-wall-bands">
      {/* 左帶:即時環境影像(不動)*/}
      <div className="dut-wall-band dut-wall-band--env">
        <div className="dut-wall-band-title">即時環境影像</div>
        <div className="dut-wall-band-body">
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
        </div>
      </div>

      {/* 右側兩帶:過程 | 結果 */}
      <div className="dut-wall-band dut-wall-band--status dut-wall-band--merged">
        <div className="dut-wall-band-split">
          {/* 測試過程 */}
          <section>
            <div className="dut-wall-band-title">
              測試過程
              {run.active ? `（${finished}/${run.items.length} 完成）` : ""}
            </div>
            <div className="dut-wall-band-body">
              {!run.active ? (
                <div className="space-y-3 p-2">
                  <button
                    onClick={runTest}
                    disabled={driving || view.testcases.length === 0}
                    className={`w-full rounded-item px-4 py-3 text-lg font-bold tracking-widest transition-colors ${
                      driving
                        ? "cursor-wait bg-white/10 text-white/40"
                        : "bg-emerald-500/90 text-[#06281c] hover:bg-emerald-400"
                    }`}
                  >
                    {driving
                      ? "啟動中…"
                      : `▶ 執行測試(${view.interface ?? "全部"} · ${view.testcases.length} 項)`}
                  </button>
                  {driveErr && <p className="text-sm text-rose-400">驅動失敗:{driveErr}</p>}
                  <p className="text-sm text-white/40">按下後此區顯示逐項進度</p>
                </div>
              ) : (
                <div className="space-y-2 p-1">
                  {run.items.map((i) => (
                    <div
                      key={i.runningId || i.testcaseId}
                      className="flex items-center gap-3 rounded-item border border-white/10 px-3 py-2"
                    >
                      <StatusDot item={i} />
                      <span className="font-mono text-sm">
                        {nameById.get(i.testcaseId) ?? i.testcaseId}
                      </span>
                      <span className="ml-auto text-xs text-white/50">
                        {i.status === "running" && i.progress != null
                          ? `${i.progress}%`
                          : STATUS_LABEL[i.status]}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 px-1 pt-1">
                    {run.startedAt && (
                      <span className="text-xs text-white/40">
                        起跑:{new Date(run.startedAt).toLocaleTimeString()}
                      </span>
                    )}
                    {run.done && (
                      <button
                        onClick={runTest}
                        disabled={driving}
                        className="ml-auto rounded-item border border-emerald-400/40 px-3 py-1 text-sm text-emerald-300 hover:bg-emerald-400/10"
                      >
                        ↻ 重新執行
                      </button>
                    )}
                  </div>
                </div>
              )}
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
                <table className="dut-wall-table dut-wall-table--cases">
                  <thead>
                    <tr>
                      <th>測項</th>
                      <th>判決</th>
                      <th>說明</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.items.map((i) => (
                      <tr key={i.runningId || i.testcaseId}>
                        <td className="font-mono">{nameById.get(i.testcaseId) ?? i.testcaseId}</td>
                        <td><VerdictPill item={i} /></td>
                        <td className="text-xs">{i.resultDescription || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<RunItemState["status"], string> = {
  pending: "等待中",
  running: "執行中",
  finished: "完成",
  error: "錯誤",
};

function StatusDot({ item }: { item: RunItemState }) {
  const cls =
    item.status === "finished"
      ? "bg-emerald-400"
      : item.status === "running"
        ? "bg-sky-400 animate-pulse"
        : item.status === "error"
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
export function useAdapterDutInfoSlots(view: WallAdapterView) {
  const { dutName, interface: iface, testcases } = view;
  const { detail } = useRicDutDetail(dutName);
  const dut = detail.dut;
  const eps = iface
    ? detail.endpoints.filter(
        (e) => e.dut_endpoint_interface.toLowerCase() === iface.toLowerCase(),
      )
    : detail.endpoints;

  return {
    dut: (
      <div className="flex h-full flex-col gap-3 overflow-auto p-2 text-white">
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
      <div className="flex h-full flex-col gap-3 overflow-auto p-2 text-white">
        <div className="text-sm uppercase tracking-widest text-white/50">
          介面連線{iface ? ` — ${iface}` : ""}
        </div>
        {eps.length === 0 ? (
          <div className="text-white/40">尚無連線端點</div>
        ) : (
          <table className="dut-wall-table">
            <thead>
              <tr><th>介面</th><th>位址</th><th>帳號</th><th>狀態</th></tr>
            </thead>
            <tbody>
              {eps.map((e) => (
                <tr key={e.dut_endpoint_uuid}>
                  <td><Badge tone="blue">{e.dut_endpoint_interface.toUpperCase()}</Badge></td>
                  <td className="font-mono text-xs">{e.dut_endpoint_address}</td>
                  <td className="text-xs">{e.dut_endpoint_username || "—"}</td>
                  <td className="text-xs">{e.dut_endpoint_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    ),
    // 測試項目清單(從中牆移來):這次會跑哪些測項(靜態輸入面)
    method: (
      <div className="flex h-full flex-col gap-2 overflow-auto p-2 text-white">
        <div className="text-sm uppercase tracking-widest text-white/50">
          測試項目{iface ? ` — ${iface}` : ""}（{testcases.length}）
        </div>
        {view.scenarioNames.length > 0 && (
          <div className="text-xs text-white/40">
            案例集:{view.scenarioNames.join("、")}
          </div>
        )}
        {testcases.length === 0 ? (
          <div className="text-white/40">此介面尚無測項</div>
        ) : (
          <table className="dut-wall-table">
            <thead>
              <tr><th>測項</th><th>說明</th></tr>
            </thead>
            <tbody>
              {testcases.map((tc: AdapterTestcase) => (
                <tr key={tc.testcaseId}>
                  <td className="font-mono text-sm">{tc.testcaseName}</td>
                  <td className="text-xs">{tc.testcaseDescription}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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
