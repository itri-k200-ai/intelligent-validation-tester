"use client";
import { useEffect, useRef, useState } from "react";

import { useRicActiveRun } from "@/hooks/Backend/useRicActiveRun";
import { useRicRunCases } from "@/hooks/Backend/useRicRunCases";
import { adapterService } from "@/services/Adapter/adapterService";
import { DEFAULT_RIC_SOURCE } from "@/config/ricSources";
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
  /** 按執行當下的探針 log 基準 uuid(探針框用來只顯示本次的新 log)*/
  baselineLogUuid: string | null;
};

const POLL_MS = 2500;

/**
 * 中牆「測試過程/結果」的資料來源:讀左螢幕廣播的 runnings,
 * 輪詢 adapter testStatus + testResult 直到全部終態。
 */
export function useAdapterRun(): AdapterRunState {
  // 兩條來源:
  //  1) 自己(左螢幕模擬器)驅動 → wallRunStore 有 runnings → 打 adapter 輪詢
  //  2) 別的團隊在他們那邊驅動 → 我們拿不到 runningId → 改讀 RICtester
  //     back_end 的 case_results,一樣能顯示逐項判決
  const { activeRun } = useRicActiveRun();
  const { cases } = useRicRunCases(activeRun?.runUuid ?? null, activeRun?.source ?? null);

  // 依當前選擇的 DUT+介面查該介面自己的 run(切換選擇不影響其他介面的 run)
  const dutName = useWallSelectionStore((s) => s.selection?.dutName);
  const iface = useWallSelectionStore((s) => s.selection?.interface);
  // 輪詢要打回「當初驅動這批測試的那一套 tester」。
  const source = useWallSelectionStore((s) => s.selection?.source) ?? DEFAULT_RIC_SOURCE;
  // runnings 有兩個來源:
  //  - wallRunStore:在中牆上按執行時,依「DUT+介面」各存一份(切走再切回還在)
  //  - selection:左螢幕(共通性測試平台模擬器)驅動後回填的 —— 中牆本身
  //    不驅動測試,所以現場實際走的是這條
  const entry = useWallRunStore((s) => s.runsByKey[runKey(dutName, iface)]);
  const selRunnings = useWallSelectionStore((s) => s.selection?.runnings);
  const selStartedAt = useWallSelectionStore((s) => s.selection?.runStartedAt);
  const runnings = entry?.runnings ?? selRunnings;
  const startedAt = entry?.startedAt ?? selStartedAt ?? null;
  const baselineLogUuid = entry?.baselineLogUuid ?? null;
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
          adapterService.testStatus(source, ids),
          adapterService.testResult(source, ids),
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
  }, [runnings, source]);

  // 跟隨外部執行時,用 back_end 的判決取代 adapter 輪詢的結果
  if (activeRun) {
    const followed: RunItemState[] = cases.map((c) => ({
      testcaseId: c.testcaseId,
      runningId: "",
      status: "finished",
      progress: 100,
      result: c.verdict === "pass" ? "passed" : "failed",
      resultDescription: c.detail || c.criteria,
    }));
    const done = !activeRun.live && followed.length >= activeRun.total;
    return {
      active: true,
      done,
      items: followed,
      passed: followed.filter((i) => i.result === "passed").length,
      failed: followed.filter((i) => i.result === "failed").length,
      startedAt: activeRun.startedAt || null,
      // 外部驅動的執行沒有「本地按下執行」那一刻,探針框不做基準過濾
      baselineLogUuid: null,
    };
  }

  const passed = items.filter((i) => i.result === "passed").length;
  const failed = items.filter((i) => i.result === "failed" || i.result === "error").length;
  const done =
    items.length > 0 &&
    items.every(
      (i) => (i.status === "finished" || i.status === "error") && i.result !== null,
    );

  return { active: items.length > 0, done, items, passed, failed, startedAt, baselineLogUuid };
}
