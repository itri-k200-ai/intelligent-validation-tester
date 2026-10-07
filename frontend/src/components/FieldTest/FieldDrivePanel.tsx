"use client";
import { AlertTriangle, Loader2, Play } from "lucide-react";
import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useAdapterCatalog,
  useRunningStatus,
  useTriggerTest,
  type AdapterDut,
  type AdapterTestcase,
} from "@/hooks/Adapter/useAdapter";
import { cn } from "@/lib/cn";
import type { FieldScenarioId } from "@/types/fieldTest";

/**
 * 驗測控制頁(/field/control)的「驅動測試」區塊。
 *
 * 驅動走 IM adapter 的 POST /autoTest/test(跟左牆操作台同一支,見 hooks/Adapter/useAdapter),
 * adapter 再去平台開一次 validation run;進度先看 adapter 的 testStatus,
 * 平台開跑之後頁面本身(進度條、軌跡、數值)就會接手顯示。
 *
 * 案例怎麼分到室內 / 室外:看案例的 DUT、情境、名稱、說明裡有沒有「室外 / 無人機」或
 * 「室內 / AMR」—— 不寫死 testcaseId,目錄重建(ID 會變)之後照樣對得上。
 *
 * 驅動會讓無人機 / AMR 真的動起來,所以一定先跳確認視窗;該情境已經有驗測在跑時不給按。
 */
export function FieldDrivePanel({ scenario, running }: { scenario: FieldScenarioId; running: boolean }) {
  const catalog = useAdapterCatalog();
  const trigger = useTriggerTest();
  const cases = casesFor(catalog.data ?? [], scenario);
  const vehicle = scenario === "outdoor" ? "無人機" : "AMR";

  const [confirm, setConfirm] = useState<AdapterTestcase | null>(null);
  /** 這一頁剛剛送出的驅動(依情境分開記,切換分頁不會混在一起) */
  const [sent, setSent] = useState<Partial<Record<FieldScenarioId, Sent>>>({});
  const mine = sent[scenario];
  const status = useRunningStatus(mine?.runningId ? [mine.runningId] : []);
  const st = (status.data ?? []).find((s) => s.runningId === mine?.runningId);

  const start = (tc: AdapterTestcase) => {
    setConfirm(null);
    trigger.mutate(tc.testcaseId, {
      onSuccess: (rows) => {
        const row = rows.find((r) => r.testcaseId === tc.testcaseId) ?? rows[0];
        setSent((m) => ({
          ...m,
          [scenario]: row?.runningId
            ? { name: caseName(tc), runningId: row.runningId, message: row.message }
            : { name: caseName(tc), runningId: null, error: row?.message || "adapter 沒有回驗測編號" },
        }));
      },
      onError: (err) => {
        const e = err as { response?: { data?: { message?: string; detail?: string } }; message?: string };
        setSent((m) => ({
          ...m,
          [scenario]: {
            name: caseName(tc),
            runningId: null,
            error: e.response?.data?.message || e.response?.data?.detail || e.message || "送出失敗",
          },
        }));
      },
    });
  };

  return (
    <section className="rounded-section border border-mint/30 bg-navy-500/70 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Play className="h-5 w-5 flex-none text-mint" strokeWidth={1.75} />
        <h2 className="text-base font-semibold text-white">驅動測試</h2>
        <span className="text-xs text-white/50">{scenario === "outdoor" ? "室外" : "室內"}</span>
      </div>

      {catalog.isLoading && <p className="text-sm text-white/50">載入測試項目…</p>}
      {catalog.isError && <p className="text-sm text-warning">連不上 adapter,暫時無法驅動測試</p>}
      {catalog.isSuccess && cases.length === 0 && (
        <p className="text-sm text-white/50">測試目錄裡沒有{scenario === "outdoor" ? "室外" : "室內"}的測試案例</p>
      )}

      <div className="flex flex-col gap-3">
        {cases.map((tc) => (
          <div
            key={tc.testcaseId}
            className="flex flex-col gap-3 rounded-item bg-white/5 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="font-medium text-white">{caseName(tc)}</div>
              {tc.testcaseDescription_zh && (
                <div className="mt-0.5 text-sm text-white/60">{tc.testcaseDescription_zh}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setConfirm(tc)}
              disabled={running || trigger.isPending}
              className={cn(
                "inline-flex flex-none items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors",
                running || trigger.isPending
                  ? "cursor-not-allowed bg-white/10 text-white/40"
                  : "bg-mint text-dark-text hover:brightness-110",
              )}
            >
              {trigger.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 送出中…
                </>
              ) : running ? (
                "驗測進行中"
              ) : (
                <>
                  <Play className="h-4 w-4" /> 驅動測試
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* 剛剛送出的那一筆:平台開跑前看 adapter 的狀態;開跑後頁面本身會接手 */}
      {mine && (
        <div
          className={cn(
            "mt-3 rounded-item px-3 py-2 text-sm",
            mine.error ? "bg-danger/10 text-danger" : "bg-mint/10 text-mint",
          )}
          role="status"
        >
          {mine.error ? (
            <>驅動失敗:{mine.error}</>
          ) : (
            <>
              已送出「{mine.name}」· 驗測編號 <span className="font-mono">{mine.runningId?.slice(0, 8)}</span>
              {st ? (
                <span className="text-white/70">
                  {" "}
                  · {st.status} {Math.round(st.progress ?? 0)}%
                </span>
              ) : (
                <span className="text-white/70"> · 等待平台開始(載具會先前往起點)</span>
              )}
            </>
          )}
        </div>
      )}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>開始驗測?</DialogTitle>
            <DialogDescription>{confirm ? caseName(confirm) : ""}</DialogDescription>
          </DialogHeader>
          {confirm?.testcaseDescription_zh && (
            <p className="text-sm text-white/75">{confirm.testcaseDescription_zh}</p>
          )}
          <div className="mt-3 flex items-start gap-2 rounded-item bg-warning/10 px-3 py-2 text-sm text-warning">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            按下開始後,{vehicle}會實際移動。請先確認場域安全、周圍沒有人員或障礙物。
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirm(null)}
              className="rounded-full border border-white/15 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10"
            >
              取消
            </button>
            <button
              type="button"
              onClick={() => confirm && start(confirm)}
              className="inline-flex items-center gap-1.5 rounded-full bg-mint px-4 py-1.5 text-sm font-semibold text-dark-text hover:brightness-110"
            >
              <Play className="h-4 w-4" /> 開始驗測
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

type Sent = { name: string; runningId: string | null; message?: string; error?: string };

const caseName = (tc: AdapterTestcase) => tc.testcaseName_zh || tc.testcaseName_en || tc.testcaseId;

/** 依名稱 / 說明裡的關鍵字把案例分到室內或室外(見元件說明) */
const KEYWORDS: Record<FieldScenarioId, RegExp> = {
  outdoor: /室外|無人機|UAV|drone|outdoor/i,
  indoor: /室內|AMR|indoor/i,
};

function casesFor(catalog: AdapterDut[], scenario: FieldScenarioId): AdapterTestcase[] {
  const other: FieldScenarioId = scenario === "outdoor" ? "indoor" : "outdoor";
  return catalog.flatMap((dut) =>
    dut.scenarioList.flatMap((sc) =>
      sc.testcaseList.filter((tc) => {
        const text = [
          dut.dutName_zh,
          dut.dutName_en,
          sc.scenarioName_zh,
          sc.scenarioName_en,
          tc.testcaseName_zh,
          tc.testcaseName_en,
          tc.testcaseDescription_zh,
        ]
          .filter(Boolean)
          .join(" ");
        // 兩邊關鍵字都有的(說不清楚是哪一個場域)就不放,寧可不出現也不要按錯
        return KEYWORDS[scenario].test(text) && !KEYWORDS[other].test(text);
      }),
    ),
  );
}
