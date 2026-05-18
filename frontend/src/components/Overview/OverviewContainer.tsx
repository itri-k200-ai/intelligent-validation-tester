"use client";
import { PageHeader } from "@/components/common/PageHeader";
import { useOverviewSummary } from "@/hooks/Overview/useOverviewSummary";

import { AgentSessionsStrip } from "./AgentSessionsStrip";
import { OverviewKpiGrid } from "./OverviewKpiGrid";
import { RecentRunsTable } from "./RecentRunsTable";

export function OverviewContainer() {
  const { data, isLoading } = useOverviewSummary();

  if (isLoading || !data) {
    return <div className="text-white/40">載入中…</div>;
  }

  return (
    <>
      <PageHeader title="驗證總覽" />
      <div className="space-y-4 md:space-y-6">
        <OverviewKpiGrid kpis={data.kpis} />
        <AgentSessionsStrip />
        <RecentRunsTable runs={data.recent_runs} />
      </div>
    </>
  );
}
