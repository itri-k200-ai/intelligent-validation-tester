"use client";
import { Maximize2, Pause, Play, Video, Volume2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { AdapterTestcase } from "@/services/Adapter/adapterService";
import type { WallAdapterView } from "@/hooks/Adapter/useWallAdapterView";
import { useRicDutDetail } from "@/hooks/Backend/useRicDutDetail";

// 中牆三帶(adapter 版):即時環境影像 | 測項清單 | 選中測項(過程/結果)。
// 中牆聚焦「測試過程與結果」;固定的受測物資訊移到右牆。
export function DutAdapterWallBands({
  view,
  onSelectTestcase,
}: {
  view: WallAdapterView;
  onSelectTestcase: (tc: AdapterTestcase) => void;
}) {
  const { interface: iface, testcases, selectedTestcase } = view;
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

      {/* 右側兩帶:測項清單 | 選中測項過程/結果 */}
      <div className="dut-wall-band dut-wall-band--status dut-wall-band--merged">
        <div className="dut-wall-band-split">
          {/* 測項清單 */}
          <section>
            <div className="dut-wall-band-title">
              測試項目{iface ? ` — ${iface}` : ""}（{testcases.length}）
            </div>
            <div className="dut-wall-band-body">
              {testcases.length === 0 ? (
                <p className="p-2 text-sm text-white/40">此介面尚無測項</p>
              ) : (
                <table className="dut-wall-table dut-wall-table--cases">
                  <thead>
                    <tr>
                      <th>測項</th>
                      <th>說明</th>
                      <th>狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testcases.map((tc) => (
                      <tr
                        key={tc.testcaseId}
                        className={selectedTestcase?.testcaseId === tc.testcaseId ? "dut-wall-case-row--active" : ""}
                        onClick={() => onSelectTestcase(tc)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="font-mono">{tc.testcaseName}</td>
                        <td>{tc.testcaseDescription}</td>
                        <td><span className="result-pill">未執行</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* 選中測項:過程 / 結果(尚未驅動 → 顯示待執行)*/}
          <section>
            <div className="dut-wall-band-title">測試過程 / 結果</div>
            <div className="dut-wall-band-body">
              {selectedTestcase ? (
                <div className="space-y-4 p-2">
                  <div>
                    <div className="text-xs text-white/60">測項</div>
                    <div className="font-mono text-xl font-semibold">
                      {selectedTestcase.testcaseName}
                    </div>
                    <div className="mt-1 text-sm text-white/60">
                      {selectedTestcase.testcaseDescription}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60">狀態</div>
                    <div className="mt-1"><Badge tone="gray">尚未執行</Badge></div>
                  </div>
                  <p className="text-sm text-white/40">
                    （執行驅動與即時結果為下一階段;按執行後這裡顯示進度與 pass/fail)
                  </p>
                </div>
              ) : (
                <p className="p-2 text-sm text-white/40">從左側清單點一個測項</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// 右牆三格內容:受測物完整明細(來自 RICtester back_end)。
// 回傳 { dut, equip, method } 三個 JSX 供 RightWingSlots 使用。
export function useAdapterDutInfoSlots(view: WallAdapterView) {
  const { dutName, interface: iface, testcases } = view;
  const { detail } = useRicDutDetail(dutName);
  const dut = detail.dut;
  // 依目前選的介面過濾連線端點(e2/a1/o1)
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
    method: (
      <div className="flex h-full flex-col gap-2 overflow-auto p-2 text-white">
        <div className="text-sm uppercase tracking-widest text-white/50">測試案例集</div>
        {view.scenarioNames.length === 0 ? (
          <div className="text-white/40">—</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {view.scenarioNames.map((n, i) => (
              <li key={i} className="text-white/80">· {n}</li>
            ))}
          </ul>
        )}
        <div className="mt-2 text-xs text-white/60">此介面測項數</div>
        <div className="text-xl tabular">{testcases.length}</div>
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
