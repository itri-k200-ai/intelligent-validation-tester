"use client";
import { KpiCard } from "@/components/common/KpiCard";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useRicOverview } from "@/hooks/Backend/useRicOverview";

const VISIBLE_RUNS = 10;
const pct = (p: number, t: number) => (t > 0 ? Math.round((p / t) * 100) : null);
const fmtTime = (s: string) => (s ? new Date(s).toLocaleString() : "—");

const STATUS_TONE: Record<string, string> = {
  completed: "text-emerald-300 bg-emerald-400/10",
  running: "text-sky-300 bg-sky-400/10",
  pending: "text-amber-300 bg-amber-400/10",
  failed: "text-rose-300 bg-rose-400/10",
  error: "text-rose-300 bg-rose-400/10",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[status] ?? "bg-white/10 text-white/60"}`}
    >
      {status || "—"}
    </span>
  );
}

// 通過率卡:大字 % + 進度條 + 通過/總數
function RateCard({
  label,
  passed,
  total,
  big,
}: {
  label: string;
  passed: number;
  total: number;
  big?: boolean;
}) {
  const rate = pct(passed, total);
  const color = rate == null ? "bg-white/20" : rate >= 80 ? "bg-emerald-400" : rate >= 50 ? "bg-amber-400" : "bg-rose-400";
  return (
    <Card>
      <CardContent className="p-3 md:p-4">
        {/* 標題與數字左右並排,壓低卡片高度 */}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/60 md:text-base">{label}</p>
          <p className={`${big ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"} font-semibold`}>
            {rate == null ? "—" : `${rate}%`}
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${rate ?? 0}%` }} />
        </div>
        <p className="mt-1 text-xs text-white/40">
          通過 {passed} / {total}
        </p>
      </CardContent>
    </Card>
  );
}

export function OverviewContainer() {
  const { data, isLoading } = useRicOverview();

  if (isLoading || !data) return <div className="text-white/40">載入中…</div>;

  const { counts, overall, byIface, recent } = data;
  const overallPct = pct(overall.passed, overall.total);

  return (
    <div className="overview-root flex h-full min-h-0 flex-col gap-3 md:gap-4">
      <PageHeader title="驗證總覽" />

      {/* 統計卡 */}
      <div className="ov-grid ov-kpi grid flex-none grid-cols-3 gap-3 md:gap-4 xl:grid-cols-6">
        <KpiCard label="受測物 DUT" value={String(counts.duts)} tone="blue" />
        <KpiCard label="測試案例" value={String(counts.testcases)} tone="green" />
        <KpiCard label="測試案例集" value={String(counts.suites)} tone="purple" />
        <KpiCard label="執行紀錄" value={String(counts.runs)} tone="blue" />
        <KpiCard label="進行中測試" value={String(counts.running)} tone="orange" />
        <KpiCard
          label="整體通過率"
          value={overallPct == null ? "—" : `${overallPct}%`}
          hint={`通過 ${overall.passed} / ${overall.total}`}
          tone="green"
        />
      </div>

      {/* 通過率 + 各介面(E2/A1/O1) */}
      <div className="ov-grid ov-rate grid flex-none grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <RateCard label="整體通過率" passed={overall.passed} total={overall.total} big />
        {byIface.map((r) => (
          <RateCard key={r.iface} label={`${r.iface} 通過率`} passed={r.passed} total={r.total} />
        ))}
        {/* 介面不足 3 個時補空卡維持版面 */}
        {Array.from({ length: Math.max(0, 3 - byIface.length) }).map((_, i) => (
          <Card key={`ph-${i}`}>
            <CardContent className="p-4 md:p-6">
              <p className="text-sm text-white/40">—</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 近期執行:只顯示最近幾筆,不換頁不捲動 */}
      <section className="ov-recent flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">近期執行</h2>
          <span className="text-xs text-white/40">最近 {VISIBLE_RUNS} 筆驗測執行</span>
        </div>
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardContent className="min-h-0 flex-1 overflow-hidden p-0">
            {recent.length === 0 ? (
              <div className="p-4 text-sm text-white/40">尚無驗測執行紀錄</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-white/50">
                  <tr className="border-b border-white/10">
                    <th className="px-4 py-2 font-medium">受測物 DUT</th>
                    <th className="px-4 py-2 font-medium">開始時間</th>
                    <th className="px-4 py-2 font-medium">狀態</th>
                    <th className="px-4 py-2 text-right font-medium">通過 / 總數</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.slice(0, VISIBLE_RUNS).map((r) => (
                    <tr key={r.run_uuid} className="border-b border-white/5">
                      <td className="px-4 py-2.5">{r.dutName}</td>
                      <td className="px-4 py-2.5 text-white/70">{fmtTime(r.started_at)}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {r.passed} / {r.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
