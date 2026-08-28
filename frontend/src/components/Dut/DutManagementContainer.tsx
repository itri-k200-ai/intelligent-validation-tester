"use client";
import { CheckCircle2, Circle, Loader2, Maximize2, Pause, Pencil, Play, Plus, RefreshCw, Video, Volume2, XCircle } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useReducer, useRef, useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { LeftWingSlot } from "@/components/layout/LeftWingSlot";
import { RightWingSlots } from "@/components/layout/RightWingSlots";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDutForm } from "@/hooks/Dut/useDutForm";
import { useDutHealthcheck } from "@/hooks/Dut/useDutHealthcheck";
import { useDutInterfaceTest } from "@/hooks/Dut/useDutInterfaceTest";
import { useDutList } from "@/hooks/Dut/useDutList";
import { useDutTestCases } from "@/hooks/Scenario/useDutTestCases";
import { useWallAdapterView } from "@/hooks/Adapter/useWallAdapterView";
import { useSites } from "@/hooks/Site/useSites";
import { DutAdapterWallBands } from "./DutAdapterWall";
import { formatDate } from "@/lib/formatters";
import {
  useTestSessionsStore,
  type TestSession,
} from "@/stores/testSessionsStore";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";
import { useIsWallMode } from "@/stores/wallModeStore";
import type { DutType } from "@/types/common";
import { AVAILABLE_INTERFACES } from "@/types/dut";
import type { Dut, InterfaceTestResult } from "@/types/dut";
import type { TestCase } from "@/types/scenario";

import { DutDetailCard } from "./DutDetailCard";
import { DutFormDialog } from "./DutFormDialog";
import { DutList } from "./DutList";
import { RunInterfaceTestDialog } from "./RunInterfaceTestDialog";

const ENV_LABEL: Record<string, string> = { indoor: "室內", outdoor: "室外" };

export function DutManagementContainer({ dutType }: { dutType: DutType }) {
  const { duts, isLoading, refresh } = useDutList({ type: dutType });
  const { create, isCreating, remove } = useDutForm();
  const { testInterface, isTesting } = useDutInterfaceTest();
  const { refreshAll, isRefreshing } = useDutHealthcheck();
  const { data: sitesData } = useSites();
  const sites = sitesData?.items ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selected, setSelected] = useState<Dut | null>(null);
  const [testResult, setTestResult] = useState<InterfaceTestResult | null>(null);
  // P1:選中 DUT 的適用測試案例 + 目前選中的案例(細節顯示在右牆)
  const { cases: testCases } = useDutTestCases(selected ? dutType : null);
  const [selectedCase, setSelectedCase] = useState<TestCase | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isWall = useIsWallMode();
  const startSession = useTestSessionsStore((s) => s.start);
  const completeSession = useTestSessionsStore((s) => s.complete);
  const removeSession = useTestSessionsStore((s) => s.remove);

  const deleteOne = async (d: Dut) => {
    if (!confirm(`確定刪除 DUT「${d.name}」?`)) return;
    setDeletingId(d.id);
    try {
      await remove(d.id);
      await refresh();
      if (selected?.id === d.id) {
        setSelected(null);
        setTestResult(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const refreshOne = async (d: Dut) => {
    setRefreshingId(d.id);
    try {
      await testInterface({ id: d.id, interfaces: d.interfaces });
      await refresh();
    } finally {
      setRefreshingId(null);
    }
  };

  useEffect(() => {
    setSelected(null);
    setTestResult(null);
    setSelectedCase(null);
  }, [dutType]);

  useEffect(() => {
    if (selected) {
      const refreshed = duts.find((d) => d.id === selected.id);
      if (refreshed && refreshed !== selected) setSelected(refreshed);
    }
  }, [duts, selected]);

  // 左螢幕選單點某台 DUT 時,廣播帶 dutId → 這裡自動選中那台。
  // 只在 dutId「換了」時套一次,不覆蓋中牆上手動點選的結果。
  const wallDutId = useWallSelectionStore((s) => s.selection?.dutId);
  const appliedWallDutIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!wallDutId || wallDutId === appliedWallDutIdRef.current) return;
    const found = duts.find((d) => d.id === wallDutId);
    if (found) {
      setSelected(found);
      appliedWallDutIdRef.current = wallDutId;
    }
  }, [wallDutId, duts]);

  const runTest = async () => {
    if (!selected) return;
    // 先把「執行測試」dialog 關掉,不要遮住主牆進度面板
    setTestDialogOpen(false);
    const sessionId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const dut = selected;
    startSession({
      id: sessionId,
      kind: "interface-validation",
      dutId: dut.id,
      dutName: dut.name,
      dutType: dut.type,
      interfaces: dut.interfaces,
      stepDurationMs: STEP_DURATION_MS,
    });
    const startedAt = Date.now();
    const minDuration = Math.max(1, dut.interfaces.length) * STEP_DURATION_MS;
    try {
      const result = await testInterface({
        id: dut.id,
        interfaces: dut.interfaces,
      });
      // 後端可能瞬間就回(mock 500ms),強制等步驟動畫至少跑完一輪
      const elapsed = Date.now() - startedAt;
      if (elapsed < minDuration) {
        await new Promise((r) => setTimeout(r, minDuration - elapsed));
      }
      setTestResult(result);
      completeSession(sessionId, result);
      await refresh();
      // session 顯示「完成」狀態 2 秒後移除,讓使用者看到結果再消失
      setTimeout(() => removeSession(sessionId), 2000);
    } catch (err) {
      removeSession(sessionId);
      throw err;
    }
  };

  const onSelect = (d: Dut) => {
    setSelected(d);
    setTestResult(null);
  };

  // 左螢幕選了 DUT·介面 → 中牆走 adapter 顯示過程/結果(讀 selection 裡的
  // runnings 輪詢)。右副牆已改為靜態說明牆,不再由這裡供稿。
  const adapterView = useWallAdapterView();

  if (isWall && adapterView.active) {
    return <DutAdapterWallBands view={adapterView} />;
  }

  if (isWall) {
    return (
      <>
        {/* 主牆:選了 DUT → 該 DUT 的三條色帶;沒選 → 該 dutType 全部設備聚合視圖 */}
        {selected ? (
          <DutWallBands
            dut={selected}
            testResult={testResult}
            testCases={testCases}
            selectedCase={selectedCase}
            onSelectCase={setSelectedCase}
          />
        ) : (
          <DutWallBandsAggregate duts={duts} dutType={dutType} />
        )}

        {/* 左副牆 page-context slot:DUT 列表 */}
        <LeftWingSlot>
          <DutSlotList
            duts={duts}
            isLoading={isLoading}
            selectedId={selected?.id ?? null}
            onSelect={onSelect}
            onAdd={() => setFormOpen(true)}
            onRefreshAll={async () => {
              await refreshAll();
              await refresh();
            }}
            isRefreshing={isRefreshing}
          />
        </LeftWingSlot>

        {/* 右副牆 slot:選了 DUT → 三格各自顯示細節(基本/連接/介面);
            沒選 → 三格顯示聚合統計(總覽/連線健康度/介面覆蓋率) */}
        <RightWingSlots
          dut={
            selected ? (
              <DutSlotBasic dut={selected} />
            ) : (
              <DutSlotAggregateOverview duts={duts} dutType={dutType} />
            )
          }
          equip={
            selected ? (
              <DutSlotConnection dut={selected} />
            ) : (
              <DutSlotAggregateConnection duts={duts} />
            )
          }
          method={
            selected ? (
              selectedCase ? (
                <DutSlotCaseDetail
                  testCase={selectedCase}
                  onBack={() => setSelectedCase(null)}
                />
              ) : (
                <DutSlotInterfaces
                  dut={selected}
                  testResult={testResult}
                  onRunTest={() => setTestDialogOpen(true)}
                />
              )
            ) : (
              <DutSlotAggregateInterfaces duts={duts} dutType={dutType} />
            )
          }
        />

        <DutFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          dutType={dutType}
          sites={sites}
          isSubmitting={isCreating}
          onSubmit={async (input) => {
            await create(input);
            await refresh();
            setFormOpen(false);
          }}
        />
        <RunInterfaceTestDialog
          open={testDialogOpen}
          onOpenChange={setTestDialogOpen}
          dut={selected}
          isRunning={isTesting}
          onRun={runTest}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title={`連接介面驗證 - ${dutType}`} />
      <p className="-mt-3 mb-4 text-sm text-white/70">
        檢查所有 {dutType} 設備的接口介面是否正常運作
      </p>

      <div className="space-y-4">
        <DutList
          duts={duts}
          isLoading={isLoading}
          selectedId={selected?.id ?? null}
          onSelect={onSelect}
          onRefresh={refreshOne}
          onDelete={deleteOne}
          refreshingId={refreshingId}
          deletingId={deletingId}
          actions={
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  await refreshAll();
                  await refresh();
                }}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                {isRefreshing ? "檢查中..." : "刷新狀態"}
              </Button>
              <Button onClick={() => setFormOpen(true)}>
                <Plus className="w-4 h-4 mr-2" /> 新增 DUT
              </Button>
            </>
          }
        />

        {selected && (
          <DutDetailCard
            dut={selected}
            testResult={testResult}
            onRunTest={() => setTestDialogOpen(true)}
          />
        )}
      </div>

      <DutFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        dutType={dutType}
        sites={sites}
        isSubmitting={isCreating}
        onSubmit={async (input) => {
          await create(input);
          await refresh();
          setFormOpen(false);
        }}
      />
      <RunInterfaceTestDialog
        open={testDialogOpen}
        onOpenChange={setTestDialogOpen}
        dut={selected}
        isRunning={isTesting}
        onRun={runTest}
      />
    </>
  );
}

// ----- 右副牆 slot panels(電視牆模式專用)-----

function SlotPanel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline gap-3">
        <span className="slot-panel-title text-2xl font-semibold">{title}</span>
        {subtitle && (
          <span className="slot-panel-subtitle text-base text-white/60">
            {subtitle}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">{children}</div>
    </div>
  );
}

// 「待測物」格 — 顯示選中的 DUT 基本資訊
function DutSlotBasic({ dut }: { dut: Dut }) {
  const isRic = dut.type === "Near-RT RIC";
  return (
    <SlotPanel title="待測物" subtitle={dut.type}>
      <div className="space-y-3">
        <div>
          <div className="text-xs text-white/60">名稱</div>
          <div className="text-xl font-semibold">{dut.name}</div>
        </div>
        {isRic && (dut.product || dut.version) && (
          <div className="flex gap-6">
            <div>
              <div className="text-xs text-white/60">產品</div>
              <div className="text-sm">{dut.product || "—"}</div>
            </div>
            <div>
              <div className="text-xs text-white/60">版本</div>
              <div className="font-mono text-sm">{dut.version || "—"}</div>
            </div>
          </div>
        )}
        {isRic && dut.description && (
          <div>
            <div className="text-xs text-white/60">描述</div>
            <div className="text-sm whitespace-pre-line">{dut.description}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-white/60">Endpoint</div>
          <div className="font-mono text-sm break-all">{dut.endpoint}</div>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <div className="text-xs text-white/60">狀態</div>
            <div className="mt-1"><StatusBadge status={dut.status} /></div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-white/60">部署場域</div>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-sm">{dut.site_name ?? "-"}</span>
              {dut.site_environment && (
                <Badge tone="gray">
                  {ENV_LABEL[dut.site_environment] ?? dut.site_environment}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </SlotPanel>
  );
}

// 左副牆 page-context — DUT 列表(取代主牆原本的大表格)
function DutSlotList({
  duts,
  isLoading,
  selectedId,
  onSelect,
  onAdd,
  onRefreshAll,
  isRefreshing,
}: {
  duts: Dut[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (d: Dut) => void;
  onAdd: () => void;
  onRefreshAll: () => void;
  isRefreshing: boolean;
}) {
  return (
    <SlotPanel title="DUT 設備" subtitle={`${duts.length} 個`}>
      <div className="flex h-full flex-col gap-2">
        <div className="flex gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={onRefreshAll} disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            刷新
          </Button>
          <Button size="sm" onClick={onAdd}>
            <Plus className="w-4 h-4 mr-1" /> 新增
          </Button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto space-y-1.5">
          {isLoading ? (
            <p className="text-sm text-white/40">載入中…</p>
          ) : duts.length === 0 ? (
            <p className="text-sm text-white/40">尚無 DUT</p>
          ) : (
            duts.map((d) => {
              const active = d.id === selectedId;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelect(d)}
                  className={`w-full text-left p-3 border rounded-item transition-colors ${
                    active
                      ? "bg-mint-300/10 border-mint-300/40"
                      : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold truncate flex-1">
                      {d.name}
                    </span>
                    <StatusBadge status={d.status} />
                  </div>
                  <div className="font-mono text-xs text-white/55 truncate mt-1">
                    {d.endpoint}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </SlotPanel>
  );
}

// === 沒選 DUT 時的聚合視圖(全部 dutType 設備) ===

// 主牆 aggregate 三條色帶
function DutWallBandsAggregate({
  duts,
  dutType,
}: {
  duts: Dut[];
  dutType: DutType;
}) {
  const total = duts.length;
  const online = duts.filter((d) => d.status === "online").length;
  const offline = duts.filter((d) => d.status === "offline").length;
  const errored = duts.filter((d) => d.status === "error").length;
  const onlineRate = total ? Math.round((online / total) * 100) : 0;

  return (
    <div className="dut-wall-bands">
      {/* 環境影像 — 沒選 DUT 時改成 onboarding/說明 */}
      <div className="dut-wall-band dut-wall-band--env">
        <div className="dut-wall-band-title">即時環境影像</div>
        <div className="dut-wall-band-body">
          <div className="aggregate-empty">
            <Video className="w-32 h-32 text-white/30" strokeWidth={1.25} />
            <p className="aggregate-empty-title">尚未選擇設備</p>
            <p className="aggregate-empty-hint">
              從左側 DUT 列表選擇任一 {dutType} 設備檢視該場域的環境串流
            </p>
            <div className="aggregate-stat-row">
              <div className="aggregate-stat">
                <div className="aggregate-stat-value">{total}</div>
                <div className="aggregate-stat-label">{dutType} 設備總數</div>
              </div>
              <div className="aggregate-stat">
                <div className="aggregate-stat-value">{onlineRate}%</div>
                <div className="aggregate-stat-label">在線率</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 測試狀態 + 測試結果 — 合併成一格(占 2 col) */}
      <div className="dut-wall-band dut-wall-band--status dut-wall-band--merged">
        <div className="dut-wall-band-split">
          <section>
            <div className="dut-wall-band-title">
              即時測試狀態 — 全部 {dutType}
            </div>
            <div className="dut-wall-band-body dut-wall-band-body--chart">
              <DutStatusChart />
            </div>
          </section>
          <section>
            <div className="dut-wall-band-title">
              全部設備狀態 — 共 {total} 台 / 在線 {online} / 離線 {offline} / 異常 {errored}
            </div>
            <div className="dut-wall-band-body">
              {total === 0 ? (
                <div className="aggregate-empty">
                  <p className="aggregate-empty-title">尚無 {dutType} 設備</p>
                  <p className="aggregate-empty-hint">點左側「新增」建立第一台</p>
                </div>
              ) : (
                <table className="dut-wall-table">
                  <thead>
                    <tr>
                      <th>設備</th>
                      <th>狀態</th>
                      <th>回應時間</th>
                      <th>最後檢查</th>
                    </tr>
                  </thead>
                  <tbody>
                    {duts.slice(0, 6).map((d) => (
                      <tr key={d.id}>
                        <td className="truncate-cell">{d.name}</td>
                        <td>
                          <span
                            className={`result-pill result-pill--${
                              d.status === "online"
                                ? "pass"
                                : d.status === "error"
                                  ? "fail"
                                  : "fail"
                            }`}
                          >
                            {d.status === "online"
                              ? "在線"
                              : d.status === "error"
                                ? "異常"
                                : "離線"}
                          </span>
                        </td>
                        <td className="tabular">
                          {d.response_time_ms != null ? `${d.response_time_ms}ms` : "—"}
                        </td>
                        <td className="tabular">{formatDate(d.last_check) ?? "—"}</td>
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

// 右副牆「待測物」格 aggregate — 設備總覽(總數 / 各狀態統計)
function DutSlotAggregateOverview({
  duts,
  dutType,
}: {
  duts: Dut[];
  dutType: DutType;
}) {
  const total = duts.length;
  const online = duts.filter((d) => d.status === "online").length;
  const offline = duts.filter((d) => d.status === "offline").length;
  const errored = duts.filter((d) => d.status === "error").length;
  const onlineRate = total ? Math.round((online / total) * 100) : 0;

  return (
    <SlotPanel title="待測物" subtitle={`${dutType} 全部設備`}>
      <div className="aggregate-slot-body">
        <div className="aggregate-big-number">
          <div className="aggregate-big-value">{total}</div>
          <div className="aggregate-big-label">總設備數</div>
        </div>
        <div className="aggregate-status-grid">
          <div className="aggregate-status aggregate-status--online">
            <div className="aggregate-status-value">{online}</div>
            <div className="aggregate-status-label">在線</div>
          </div>
          <div className="aggregate-status aggregate-status--offline">
            <div className="aggregate-status-value">{offline}</div>
            <div className="aggregate-status-label">離線</div>
          </div>
          <div className="aggregate-status aggregate-status--error">
            <div className="aggregate-status-value">{errored}</div>
            <div className="aggregate-status-label">異常</div>
          </div>
        </div>
        <div className="aggregate-rate">
          <div className="aggregate-rate-label">整體在線率</div>
          <div className="aggregate-rate-bar">
            <div
              className="aggregate-rate-fill"
              style={{ width: `${onlineRate}%` }}
            />
          </div>
          <div className="aggregate-rate-value">{onlineRate}%</div>
        </div>
      </div>
    </SlotPanel>
  );
}

// 右副牆「測試設備」格 aggregate — 連線健康度
function DutSlotAggregateConnection({ duts }: { duts: Dut[] }) {
  const responseTimes = duts
    .map((d) => d.response_time_ms)
    .filter((x): x is number => x != null);
  const avgResponse = responseTimes.length
    ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
    : null;
  const minResponse = responseTimes.length ? Math.min(...responseTimes) : null;
  const maxResponse = responseTimes.length ? Math.max(...responseTimes) : null;
  const checked = duts.filter((d) => d.last_check != null).length;

  return (
    <SlotPanel title="測試設備" subtitle="連線健康度">
      <div className="aggregate-slot-body">
        <div className="aggregate-metric-list">
          <div className="aggregate-metric">
            <span className="aggregate-metric-label">平均回應時間</span>
            <span className="aggregate-metric-value">
              {avgResponse != null ? `${avgResponse} ms` : "—"}
            </span>
          </div>
          <div className="aggregate-metric">
            <span className="aggregate-metric-label">最快</span>
            <span className="aggregate-metric-value">
              {minResponse != null ? `${minResponse} ms` : "—"}
            </span>
          </div>
          <div className="aggregate-metric">
            <span className="aggregate-metric-label">最慢</span>
            <span className="aggregate-metric-value">
              {maxResponse != null ? `${maxResponse} ms` : "—"}
            </span>
          </div>
          <div className="aggregate-metric">
            <span className="aggregate-metric-label">已檢查</span>
            <span className="aggregate-metric-value">
              {checked} / {duts.length}
            </span>
          </div>
        </div>
      </div>
    </SlotPanel>
  );
}

// 右副牆「測試方法」格 aggregate — 介面覆蓋率
function DutSlotAggregateInterfaces({
  duts,
  dutType,
}: {
  duts: Dut[];
  dutType: DutType;
}) {
  const allIfaces = AVAILABLE_INTERFACES[dutType];
  const counts = allIfaces.map((iface) => ({
    iface,
    count: duts.filter((d) => d.interfaces.includes(iface)).length,
    rate: duts.length
      ? Math.round(
          (duts.filter((d) => d.interfaces.includes(iface)).length / duts.length) *
            100,
        )
      : 0,
  }));

  return (
    <SlotPanel title="測試方法" subtitle="介面覆蓋率">
      <div className="aggregate-slot-body">
        {counts.length === 0 ? (
          <p className="text-sm text-white/40">此設備類型未定義介面</p>
        ) : (
          <div className="aggregate-iface-list">
            {counts.map((c) => (
              <div key={c.iface} className="aggregate-iface">
                <div className="aggregate-iface-header">
                  <span className="aggregate-iface-name">{c.iface}</span>
                  <span className="aggregate-iface-count">
                    {c.count} / {duts.length}
                  </span>
                </div>
                <div className="aggregate-rate-bar">
                  <div
                    className="aggregate-rate-fill"
                    style={{ width: `${c.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SlotPanel>
  );
}

// 主牆:三條色帶(即時環境影像 / 即時測試狀態 / 即時測試結果)
function DutWallBands({
  dut,
  testResult,
  testCases = [],
  selectedCase = null,
  onSelectCase,
}: {
  dut: Dut | null;
  testResult: InterfaceTestResult | null;
  testCases?: TestCase[];
  selectedCase?: TestCase | null;
  onSelectCase?: (c: TestCase) => void;
}) {
  const sessions = useTestSessionsStore((s) => s.sessions);
  const hasSessions = sessions.length > 0;
  return (
    <div className="dut-wall-bands">
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
              <button type="button" aria-label="play">
                <Play className="w-5 h-5" />
              </button>
              <button type="button" aria-label="pause">
                <Pause className="w-5 h-5" />
              </button>
              <span className="video-time">00:00</span>
              <div className="video-timeline">
                <div className="video-progress" />
              </div>
              <span className="video-time">--:--</span>
              <button type="button" aria-label="volume">
                <Volume2 className="w-5 h-5" />
              </button>
              <button type="button" aria-label="fullscreen">
                <Maximize2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="dut-wall-band dut-wall-band--status dut-wall-band--merged">
        <div className="dut-wall-band-split">
          <section>
            <div className="dut-wall-band-title">
              {hasSessions
                ? `即時測試狀態 — ${sessions.length} 個進行中`
                : "即時測試狀態"}
            </div>
            {hasSessions ? (
              <div className="dut-wall-band-body">
                <TestProgressList sessions={sessions} />
              </div>
            ) : (
              <div className="dut-wall-band-body dut-wall-band-body--chart">
                <DutStatusChart />
              </div>
            )}
          </section>
          <section>
            <div className="dut-wall-band-title">
              適用測試案例{testCases.length > 0 ? ` — ${testCases.length} 項` : ""}
            </div>
            <div className="dut-wall-band-body">
              {testCases.length === 0 ? (
                <p className="text-sm text-white/40 p-2">此類型尚無測試案例</p>
              ) : (
                <table className="dut-wall-table dut-wall-table--cases">
                  <thead>
                    <tr>
                      <th>案例</th>
                      <th>介面</th>
                      <th>名稱</th>
                      <th>等級</th>
                    </tr>
                  </thead>
                  <tbody>
                    {testCases.map((c) => (
                      <tr
                        key={c.id}
                        className={
                          selectedCase?.id === c.id ? "dut-wall-case-row--active" : ""
                        }
                        onClick={() => onSelectCase?.(c)}
                        style={{ cursor: "pointer" }}
                      >
                        <td className="tabular">{c.case_id}</td>
                        <td>{c.interface && <Badge tone="blue">{c.interface}</Badge>}</td>
                        <td>{c.name}</td>
                        <td className="tabular">{c.priority}</td>
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

// 主牆「即時測試狀態」執行中 — 進度列表。每個 session 一列,顯示 DUT 名稱 +
// 當前步驟 + 進度 bar + 已耗時。後端目前是一次回所有結果(沒有 per-interface
// streaming),所以「當前步驟」用 elapsed/stepDurationMs 做合成切換 — 視覺上
// 有逐步推進感,完成時實際結果由 runTest 落到右副牆「測試方法」格。
const STEP_DURATION_MS = 1500;

function TestProgressList({ sessions }: { sessions: TestSession[] }) {
  // 用一個 100ms 的 ticker 強制全部 row 一起 re-render(共用 elapsed 計算)
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="test-progress-list">
      {sessions.map((s) => (
        <TestProgressRow key={s.id} session={s} />
      ))}
    </div>
  );
}

function TestProgressRow({ session }: { session: TestSession }) {
  const total = session.interfaces.length;
  const isDone = session.status === "done";
  const elapsed = isDone
    ? total * session.stepDurationMs
    : Date.now() - session.startedAt;
  const totalDuration = total * session.stepDurationMs;
  const currentIdx = isDone
    ? total
    : Math.min(Math.floor(elapsed / session.stepDurationMs), total - 1);
  const progressPct = isDone
    ? 100
    : totalDuration
      ? Math.min(100, (elapsed / totalDuration) * 100)
      : 0;
  const allOk = isDone && session.result?.ok;

  return (
    <div
      className={`test-progress-row ${isDone ? "test-progress-row--done" : ""}`}
    >
      <div className="test-progress-row-head">
        <div className="test-progress-row-title">
          <span className="test-progress-row-name">{session.dutName}</span>
          <span className="test-progress-row-type">{session.dutType}</span>
        </div>
        <div className="test-progress-row-meta">
          {isDone ? (
            <span
              className={
                allOk
                  ? "test-progress-row-result test-progress-row-result--pass"
                  : "test-progress-row-result test-progress-row-result--fail"
              }
            >
              {allOk ? "全部通過" : "有失敗"}
            </span>
          ) : (
            <span className="test-progress-row-stepname">
              {session.interfaces[currentIdx] ?? ""} · {currentIdx + 1}/{total}
            </span>
          )}
          <span className="test-progress-row-elapsed">
            {(elapsed / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
      <div className="test-progress-bar">
        <div
          className="test-progress-bar-fill"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="test-progress-row-steps">
        {session.interfaces.map((iface, i) => {
          const status: "done" | "running" | "pending" = isDone
            ? "done"
            : i < currentIdx
              ? "done"
              : i === currentIdx
                ? "running"
                : "pending";
          // 完成後若 result 有 per-interface 詳情,以實際結果取代合成
          const ifaceResult = isDone ? session.result?.results[iface] : null;
          const finalOk = ifaceResult ? ifaceResult.ok : status === "done";
          return (
            <div
              key={iface}
              className={`test-pill test-pill--${
                isDone ? (finalOk ? "pass" : "fail") : status
              }`}
            >
              {status === "running" && (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              {status === "done" &&
                (finalOk ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                ))}
              {status === "pending" && <Circle className="w-5 h-5" />}
              <span>{iface}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 「測試設備」格 — 連接資訊(資料格式 / 回應時間 / 最後檢查)
function DutSlotConnection({ dut }: { dut: Dut }) {
  const isRic = dut.type === "Near-RT RIC";
  const hasE2Id = dut.e2_mcc || dut.e2_mnc || dut.e2_gnb_id || dut.e2_cell_id;
  return (
    <SlotPanel title="測試設備" subtitle="連接資訊">
      <div className="space-y-3 text-sm">
        {isRic && (
          <>
            <div>
              <div className="text-xs text-white/60">E2 身分（gNB）</div>
              <div className="mt-1 font-mono text-xs">
                {hasE2Id
                  ? `MCC ${dut.e2_mcc || "—"} / MNC ${dut.e2_mnc || "—"} / gNB ${dut.e2_gnb_id || "—"} / Cell ${dut.e2_cell_id || "—"}`
                  : "未設定"}
              </div>
            </div>
            <div>
              <div className="text-xs text-white/60">各介面連線位址</div>
              <div className="mt-1 space-y-0.5 font-mono text-xs">
                <div>E2: {dut.e2_address || "—"}</div>
                <div>A1: {dut.a1_address || "—"}</div>
                <div>O1: {dut.o1_address || "—"}</div>
              </div>
            </div>
          </>
        )}
        <div>
          <div className="text-xs text-white/60">資料格式</div>
          <div className="mt-1">{dut.data_format || "未知"}</div>
        </div>
        <div>
          <div className="text-xs text-white/60">回應時間</div>
          <div className="mt-1">
            {dut.response_time_ms != null ? `${dut.response_time_ms}ms` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/60">最後檢查</div>
          <div className="mt-1">{formatDate(dut.last_check)}</div>
        </div>
      </div>
    </SlotPanel>
  );
}

// 右牆「測試方法」格 — 中牆選中某測試案例時,顯示該案細節(對齊 RICtester)
function DutSlotCaseDetail({
  testCase,
  onBack,
}: {
  testCase: TestCase;
  onBack: () => void;
}) {
  const specs = [
    ...(testCase.spec_sections ?? []),
  ].filter(Boolean);
  return (
    <SlotPanel title={testCase.case_id} subtitle="測試案例">
      <div className="flex h-full flex-col gap-3 overflow-auto text-sm">
        <div>
          <div className="text-lg font-semibold">{testCase.name}</div>
          <div className="mt-1 flex items-center gap-2 text-xs text-white/60">
            {testCase.interface && <Badge tone="blue">{testCase.interface}</Badge>}
            {testCase.oran_release && <span>O-RAN {testCase.oran_release}</span>}
            <span>· {testCase.priority}</span>
          </div>
        </div>
        {testCase.preconditions && (
          <div>
            <div className="text-xs text-white/60">前置條件</div>
            <div className="mt-1 whitespace-pre-line">{testCase.preconditions}</div>
          </div>
        )}
        <div>
          <div className="text-xs text-white/60">測試程序</div>
          <div className="mt-1 whitespace-pre-line">
            {testCase.test_steps || <span className="text-white/40">—</span>}
          </div>
        </div>
        <div>
          <div className="text-xs text-white/60">通過條件</div>
          <div className="mt-1 whitespace-pre-line text-mint-300">
            {testCase.pass_criteria || <span className="text-white/40">—</span>}
          </div>
        </div>
        {specs.length > 0 && (
          <div>
            <div className="text-xs text-white/60">規格章節</div>
            <div className="mt-1 font-mono text-xs space-y-0.5">
              {specs.map((s, i) => (
                <div key={i}>{s}</div>
              ))}
            </div>
          </div>
        )}
        <div className="mt-auto pt-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← 回案例清單
          </Button>
        </div>
      </div>
    </SlotPanel>
  );
}

// 「測試方法」格 — 介面測試結果 + 執行按鈕
function DutSlotInterfaces({
  dut,
  testResult,
  onRunTest,
}: {
  dut: Dut;
  testResult: InterfaceTestResult | null;
  onRunTest: () => void;
}) {
  return (
    <SlotPanel title="測試方法" subtitle={`${dut.interfaces.length} 個介面`}>
      <div className="flex h-full flex-col gap-3">
        <div className="flex-1 min-h-0 overflow-auto space-y-2">
          {dut.interfaces.length === 0 ? (
            <p className="text-sm text-white/40">此設備未設定任何介面</p>
          ) : (
            dut.interfaces.map((iface) => {
              const r = testResult?.results[iface];
              const status = r ? (r.ok ? "pass" : "fail") : "none";
              return (
                <div
                  key={iface}
                  className="flex items-center justify-between p-2 border rounded-item"
                >
                  <div className="flex items-center gap-2">
                    {status === "pass" && <CheckCircle2 className="w-5 h-5 text-mint-300" />}
                    {status === "fail" && <XCircle className="w-5 h-5 text-danger" />}
                    {status === "none" && <Circle className="w-5 h-5 text-white/40" />}
                    <span className="text-sm font-medium">{iface}</span>
                  </div>
                  <Badge
                    tone={status === "pass" ? "green" : status === "fail" ? "red" : "gray"}
                  >
                    {status === "pass" ? "通過" : status === "fail" ? "失敗" : "未測試"}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" size="sm" onClick={onRunTest}>
            <Play className="w-4 h-4 mr-1" /> 執行測試
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Pencil className="w-4 h-4 mr-1" /> 編輯
          </Button>
        </div>
      </div>
    </SlotPanel>
  );
}

// 主牆「即時測試狀態」折線圖 — 各介面回應時間隨時間變化(假資料)
const STATUS_CHART_DATA = [
  { t: "14:30", O1: 42, A1: 78, E2: 56 },
  { t: "14:31", O1: 38, A1: 82, E2: 51 },
  { t: "14:32", O1: 51, A1: 91, E2: 48 },
  { t: "14:33", O1: 47, A1: 88, E2: 62 },
  { t: "14:34", O1: 55, A1: 73, E2: 58 },
  { t: "14:35", O1: 49, A1: 68, E2: 71 },
  { t: "14:36", O1: 43, A1: 75, E2: 65 },
  { t: "14:37", O1: 46, A1: 81, E2: 59 },
  { t: "14:38", O1: 52, A1: 86, E2: 54 },
  { t: "14:39", O1: 48, A1: 79, E2: 61 },
  { t: "14:40", O1: 41, A1: 72, E2: 57 },
];

function DutStatusChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={STATUS_CHART_DATA}
        margin={{ top: 40, right: 60, left: 40, bottom: 30 }}
      >
        <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="6 6" />
        <XAxis
          dataKey="t"
          stroke="rgba(255,255,255,0.65)"
          tick={{ fontSize: 80, fill: "rgba(255,255,255,0.85)" }}
          tickMargin={20}
          axisLine={{ strokeWidth: 2 }}
        />
        <YAxis
          stroke="rgba(255,255,255,0.65)"
          unit="ms"
          tick={{ fontSize: 80, fill: "rgba(255,255,255,0.85)" }}
          tickMargin={20}
          axisLine={{ strokeWidth: 2 }}
          width={140}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(10,23,47,0.94)",
            border: "2px solid rgba(255,255,255,0.2)",
            borderRadius: 16,
            fontSize: 72,
            padding: "16px 24px",
          }}
          labelStyle={{ color: "rgba(255,255,255,0.9)", fontSize: 72 }}
          itemStyle={{ fontSize: 72, padding: "4px 0" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 84, paddingTop: 16 }}
          iconSize={48}
          iconType="line"
        />
        <Line type="monotone" dataKey="O1" stroke="#80FFE8" strokeWidth={6} dot={{ r: 8 }} activeDot={{ r: 12 }} />
        <Line type="monotone" dataKey="A1" stroke="#72B6C9" strokeWidth={6} dot={{ r: 8 }} activeDot={{ r: 12 }} />
        <Line type="monotone" dataKey="E2" stroke="#B490FF" strokeWidth={6} dot={{ r: 8 }} activeDot={{ r: 12 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
