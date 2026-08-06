"use client";
import { useEffect, useRef, useState } from "react";

import { adapterService } from "@/services/Adapter/adapterService";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";
import { runKey, useWallRunStore } from "@/stores/wallRunStore";

export type RunItemState = {
  testcaseId: string;
  runningId: string;
  status: "running" | "finished" | "error" | "pending";
  progress: number | null;
  result: "passed" | "failed" | "error" | null;
  resultDescription: string;
};

export type AdapterRunState = {
  /** 有沒有進行中/剛跑完的 run(左螢幕按過執行)*/
  active: boolean;
  /** 全部都到終態(finished/error 且拿到 result)*/
  done: boolean;
  items: RunItemState[];
  passed: number;
  failed: number;
  startedAt: string | null;
};

const POLL_MS = 2500;

/**
 * 中牆「測試過程/結果」的資料來源:讀左螢幕廣播的 runnings,
 * 輪詢 adapter testStatus + testResult 直到全部終態。
 */
export function useAdapterRun(): AdapterRunState {
  // 依當前選擇的 DUT+介面查該介面自己的 run(切換選擇不影響其他介面的 run)
  const dutName = useWallSelectionStore((s) => s.selection?.dutName);
  const iface = useWallSelectionStore((s) => s.selection?.interface);
  const entry = useWallRunStore((s) => s.runsByKey[runKey(dutName, iface)]);
  const runnings = entry?.runnings;
  const startedAt = entry?.startedAt ?? null;
  const [items, setItems] = useState<RunItemState[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (!runnings || runnings.length === 0) {
      setItems([]);
      return;
    }
    // 初始:全部 pending
    setItems(
      runnings.map((r) => ({
        ...r,
        status: "pending",
        progress: null,
        result: null,
        resultDescription: "",
      })),
    );

    const ids = runnings.map((r) => r.runningId).filter(Boolean);
    if (ids.length === 0) return;

    let stopped = false;
    const poll = async () => {
      try {
        const [statuses, results] = await Promise.all([
          adapterService.testStatus(ids),
          adapterService.testResult(ids),
        ]);
        if (stopped) return;
        const stByRid = new Map(statuses.map((s) => [s.runningId, s]));
        const rsByRid = new Map(results.map((r) => [r.runningId, r]));
        let allDone = true;
        setItems(
          runnings.map((r) => {
            const st = stByRid.get(r.runningId);
            const rs = rsByRid.get(r.runningId);
            const status = (st?.status as RunItemState["status"]) ?? "pending";
            // result 為 error + still running 字樣時代表還沒有判決
            const hasVerdict =
              rs && !(rs.result === "error" && /running/i.test(rs.resultDescription));
            if (status === "running" || status === "pending" || !hasVerdict) allDone = false;
            return {
              ...r,
              status,
              progress: st?.progress ?? null,
              result: hasVerdict ? (rs.result as RunItemState["result"]) : null,
              resultDescription: hasVerdict ? rs.resultDescription : "",
            };
          }),
        );
        if (allDone && timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch {
        /* 單次輪詢失敗就等下一輪 */
      }
    };
    poll();
    timerRef.current = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [runnings]);

  const passed = items.filter((i) => i.result === "passed").length;
  const failed = items.filter((i) => i.result === "failed" || i.result === "error").length;
  const done =
    items.length > 0 &&
    items.every(
      (i) => (i.status === "finished" || i.status === "error") && i.result !== null,
    );

  return { active: items.length > 0, done, items, passed, failed, startedAt };
}
