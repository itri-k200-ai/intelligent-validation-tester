"use client";
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useScenarioDetail } from "@/hooks/Scenario/useScenarioDetail";
import { useScenarioForm } from "@/hooks/Scenario/useScenarioForm";
import { useScenarioRuns } from "@/hooks/ValidationRun/useScenarioRuns";
import { formatDate, formatScore } from "@/lib/formatters";

import { ScenarioFormDialog } from "./ScenarioFormDialog";
import {
  SCENARIO_CATEGORY_LABEL,
  VALIDATION_TYPE_LABEL,
} from "@/types/scenario";

const STATUS_TONE: Record<string, "green" | "red" | "orange" | "gray" | "blue"> = {
  passed: "green",
  failed: "red",
  running: "blue",
  pending: "orange",
  cancelled: "gray",
};

const STATUS_LABEL: Record<string, string> = {
  passed: "通過",
  failed: "未通過",
  running: "執行中",
  pending: "等待中",
  cancelled: "已取消",
};

export function ScenarioDetailContainer({ id }: { id: string }) {
  const { scenario, isLoading } = useScenarioDetail(id);
  const { runs, isLoading: runsLoading } = useScenarioRuns(scenario?.id ?? null);
  const { update, isUpdating } = useScenarioForm();
  const [editOpen, setEditOpen] = useState(false);

  if (isLoading) {
    return (
      <>
        <PageHeader title="情境詳情" />
        <p className="text-white/40">載入中…</p>
      </>
    );
  }

  if (!scenario) {
    return (
      <>
        <PageHeader title="情境詳情" />
        <p className="text-warning">找不到此情境。</p>
        <Link href="/test-scenarios">
          <Button variant="outline" className="mt-3">
            <ArrowLeft className="w-4 h-4 mr-2" /> 回列表
          </Button>
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader title={scenario.name}>
        <Button variant="outline" onClick={() => setEditOpen(true)}>
          <Pencil className="w-4 h-4 mr-2" /> 編輯
        </Button>
        <Link href="/test-scenarios">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" /> 回列表
          </Button>
        </Link>
      </PageHeader>
      <ScenarioFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        existing={scenario}
        isSubmitting={isUpdating}
        onSubmit={async (input) => {
          await update({ id: scenario.id, input });
          setEditOpen(false);
        }}
      />
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>情境資訊</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Field label="場域">
                {scenario.site_name ? (
                  <div className="flex items-center gap-2">
                    <span>{scenario.site_name}</span>
                    {scenario.site_region && (
                      <Link
                        href={`/site-management/${scenario.site_region}`}
                        className="text-mint-300 hover:underline inline-flex items-center gap-1 text-xs"
                      >
                        前往場域 <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}
                  </div>
                ) : (
                  <span className="text-white/40">未指定</span>
                )}
              </Field>
              <Field label="類別">
                <Badge tone="gray">{SCENARIO_CATEGORY_LABEL[scenario.category]}</Badge>
              </Field>
              <Field label="驗證類型">
                <Badge tone="blue">{VALIDATION_TYPE_LABEL[scenario.validation_type]}</Badge>
              </Field>
              <Field label="DUT 類型">
                {scenario.dut_type ? (
                  <Badge tone="gray">{scenario.dut_type}</Badge>
                ) : (
                  <span className="text-white/40">未指定</span>
                )}
              </Field>
              <Field label="來源 DUT">
                {scenario.source_dut_name ? (
                  <>
                    <span>{scenario.source_dut_name}</span>
                    {scenario.source_dut_type && (
                      <Badge tone="gray" className="ml-2">{scenario.source_dut_type}</Badge>
                    )}
                  </>
                ) : (
                  <span className="text-white/40">未指定</span>
                )}
              </Field>
              <Field label="AI Case">
                {scenario.ai_case || <span className="text-white/40">-</span>}
              </Field>
              <Field label="收集時間">{formatDate(scenario.collected_at)}</Field>
              <Field label="資料筆數">
                {scenario.row_count != null
                  ? scenario.row_count.toLocaleString()
                  : <span className="text-white/40">-</span>}
              </Field>
            </div>
            {scenario.description && (
              <div className="mt-4 pt-4 border-t">
                <div className="text-sm text-white/70 mb-1">描述</div>
                <p className="text-sm whitespace-pre-line">{scenario.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 規格來源 — agent 引用此 case 時的證據文件 */}
        {(scenario as any).source_document && (
          <Card>
            <CardHeader>
              <CardTitle>規格來源</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <Field label="文件">
                  <div className="flex flex-col gap-1">
                    <span>
                      [{(scenario as any).source_document_type}]{" "}
                      <span className="font-mono">{(scenario as any).source_document_version}</span>
                    </span>
                    <span className="text-white/80">{(scenario as any).source_document_name}</span>
                  </div>
                </Field>
                <Field label="章節">
                  <span className="font-mono text-xs">{(scenario as any).source_section || "—"}</span>
                </Field>
              </div>
              {(scenario as any).source_document_download_url && (
                <button
                  onClick={() => import("@/lib/authDownload").then((m) =>
                    m.authDownload(
                      (scenario as any).source_document_download_url,
                      (scenario as any).source_document_name
                    ))}
                  className="mt-3 inline-flex items-center gap-1 text-teal text-xs hover:underline"
                >
                  ↓ 下載證據 PDF / 文件
                </button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>參數</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(scenario.parameters ?? {}).length === 0 ? (
              <p className="text-sm text-white/40">無參數</p>
            ) : (
              <pre className="text-xs bg-white/5 border rounded p-3 overflow-x-auto">
                {JSON.stringify(scenario.parameters, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>相關驗證執行</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {runsLoading ? (
              <div className="p-6 text-white/40 text-sm">載入中…</div>
            ) : runs.length === 0 ? (
              <div className="p-6 text-white/40 text-sm">尚未有驗證執行紀錄</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-white/60 bg-white/5 border-b">
                      <th className="px-4 py-3">Run ID</th>
                      <th className="px-4 py-3">狀態</th>
                      <th className="px-4 py-3 text-right">分數</th>
                      <th className="px-4 py-3">開始時間</th>
                      <th className="px-4 py-3">結束時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-white/5">
                        <td className="px-4 py-3 font-mono text-xs">{r.id.slice(0, 8)}</td>
                        <td className="px-4 py-3">
                          <Badge tone={STATUS_TONE[r.status] ?? "gray"}>
                            {STATUS_LABEL[r.status] ?? r.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatScore(r.score)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/70">
                          {formatDate(r.started_at)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/70">
                          {formatDate(r.ended_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-white/70">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}
