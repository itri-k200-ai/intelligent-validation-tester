"use client";
import { FileText } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { FieldMission } from "@/types/fieldTest";

import { PdfPages } from "./PdfPages";

const fmt = (t?: number | null) =>
  t
    ? new Date(t * 1000).toLocaleString("zh-TW", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";

/**
 * 驗測報告的彈窗(一般 / 手機版專用,中牆沒有)。
 *
 * 上方是「這是哪一次驗測」的識別資訊,下面是報告本體 —— IM adapter 的
 * GET /autoTest/history/{id}/report.pdf(id 給平台的 run_id 或 adapter 的 runningId 都可以,
 * 實測兩者回同一份),經 nginx 的 /ric/im/autoTest/ 代理。
 *
 * PDF 只在彈窗打開時才抓(Radix 關閉時會卸載內容),不會每次輪詢都下載。
 */
export function FieldReportDialog({ mission, status }: { mission: FieldMission; status: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-sm text-white transition-colors hover:border-mint/60 hover:bg-white/10"
        >
          <FileText className="h-4 w-4 text-teal" strokeWidth={1.75} />
          驗測報告
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>驗測報告</DialogTitle>
          <DialogDescription>
            {mission.testcase.name} · {mission.testcase.environment}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-item bg-white/5 px-4 py-3 text-sm sm:grid-cols-2">
          <Row k="測試項目" v={mission.testcase.name} />
          <Row k="測試環境" v={mission.testcase.environment} />
          <Row k="驗測狀態" v={status} />
          <Row k="驗測編號" v={mission.runId ? mission.runId.slice(0, 8) : "—"} mono />
          <Row k="開始時間" v={fmt(mission.createdAt)} />
          <Row k="結束時間" v={fmt(mission.endedAt)} />
        </dl>

        <div className="mt-4">
          {mission.runId ? (
            <PdfPages
              url={`/ric/im/autoTest/history/${encodeURIComponent(mission.runId)}/report.pdf`}
              filename={`report_${mission.runId.slice(0, 8)}.pdf`}
            />
          ) : (
            <div className="flex min-h-[240px] items-center justify-center rounded-item border border-dashed border-white/15 text-sm text-white/40">
              目前沒有可顯示的驗測紀錄
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ k, v, mono = false }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-3">
      <dt className="w-16 flex-none text-white/55">{k}</dt>
      <dd className={`min-w-0 truncate text-white ${mono ? "font-mono" : ""}`}>{v}</dd>
    </div>
  );
}
