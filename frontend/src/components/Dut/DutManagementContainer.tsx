"use client";
import { CheckCircle2, Circle, Maximize2, Pause, Pencil, Play, Plus, RefreshCw, Video, Volume2, XCircle } from "lucide-react";
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
import { useEffect, useState } from "react";

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
import { useSites } from "@/hooks/Site/useSites";
import { formatDate } from "@/lib/formatters";
import { useIsWallMode } from "@/stores/wallModeStore";
import type { DutType } from "@/types/common";
import type { Dut, InterfaceTestResult } from "@/types/dut";

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
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isWall = useIsWallMode();

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
  }, [dutType]);

  useEffect(() => {
    if (selected) {
      const refreshed = duts.find((d) => d.id === selected.id);
      if (refreshed && refreshed !== selected) setSelected(refreshed);
    }
  }, [duts, selected]);

  const runTest = async () => {
    if (!selected) return;
    const result = await testInterface({
      id: selected.id,
      interfaces: selected.interfaces,
    });
    setTestResult(result);
    setTestDialogOpen(false);
    await refresh();
  };

  const onSelect = (d: Dut) => {
    setSelected(d);
    setTestResult(null);
  };

  if (isWall) {
    return (
      <>
        {/* 主牆:三條色帶 — 即時環境影像 / 即時測試狀態 / 即時測試結果 */}
        <DutWallBands dut={selected} testResult={testResult} />

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

        {/* 右副牆 slot:選了 DUT 之後三格各自顯示細節(基本/連接/介面) */}
        <RightWingSlots
          dut={
            selected ? <DutSlotBasic dut={selected} /> : <SlotEmpty label="待測物" />
          }
          equip={
            selected ? <DutSlotConnection dut={selected} /> : <SlotEmpty label="測試設備" />
          }
          method={
            selected ? (
              <DutSlotInterfaces
                dut={selected}
                testResult={testResult}
                onRunTest={() => setTestDialogOpen(true)}
              />
            ) : (
              <SlotEmpty label="測試方法" />
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
  return (
    <SlotPanel title="待測物" subtitle={dut.type}>
      <div className="space-y-3">
        <div>
          <div className="text-xs text-white/60">名稱</div>
          <div className="text-xl font-semibold">{dut.name}</div>
        </div>
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

// 沒有選 DUT 時的空 slot placeholder
function SlotEmpty({ label }: { label: string }) {
  return (
    <SlotPanel title={label}>
      <p className="text-sm text-white/40">先選擇 DUT</p>
    </SlotPanel>
  );
}

// 主牆:三條色帶(即時環境影像 / 即時測試狀態 / 即時測試結果)
function DutWallBands({
  dut,
  testResult,
}: {
  dut: Dut | null;
  testResult: InterfaceTestResult | null;
}) {
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
      <div className="dut-wall-band dut-wall-band--status">
        <div className="dut-wall-band-title">即時測試狀態</div>
        <div className="dut-wall-band-body dut-wall-band-body--chart">
          <DutStatusChart />
        </div>
      </div>
      <div className="dut-wall-band dut-wall-band--result">
        <div className="dut-wall-band-title">即時測試結果</div>
        <div className="dut-wall-band-body">
          <table className="dut-wall-table">
            <thead>
              <tr>
                <th>介面</th>
                <th>結果</th>
                <th>回應時間</th>
                <th>時間戳</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>O1</td>
                <td><span className="result-pill result-pill--pass">通過</span></td>
                <td className="tabular">45ms</td>
                <td className="tabular">14:32:01</td>
              </tr>
              <tr>
                <td>A1</td>
                <td><span className="result-pill result-pill--fail">失敗</span></td>
                <td className="tabular">timeout</td>
                <td className="tabular">14:31:55</td>
              </tr>
              <tr>
                <td>E2</td>
                <td><span className="result-pill result-pill--pass">通過</span></td>
                <td className="tabular">120ms</td>
                <td className="tabular">14:31:50</td>
              </tr>
              <tr>
                <td>O1</td>
                <td><span className="result-pill result-pill--pass">通過</span></td>
                <td className="tabular">38ms</td>
                <td className="tabular">14:30:48</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// 「測試設備」格 — 連接資訊(資料格式 / 回應時間 / 最後檢查)
function DutSlotConnection({ dut }: { dut: Dut }) {
  return (
    <SlotPanel title="測試設備" subtitle="連接資訊">
      <div className="space-y-3 text-sm">
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
