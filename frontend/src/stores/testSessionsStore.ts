"use client";
import { create } from "zustand";

import type { DutType } from "@/types/common";
import type { InterfaceTestResult } from "@/types/dut";

/**
 * 全域測試 session 佇列。所有「執行測試」的入口(各 DUT 頁、未來其他類型測試)
 * 都把 session push 進來,主牆「即時測試狀態」色帶根據佇列數量切換視圖:
 *   0 → 折線圖
 *   1 → 單一進度面板(原 TestProgressPanel)
 *   2+ → 多列 list view
 *
 * Session 結束後 caller 應該標 done 並延遲幾秒後 remove(讓使用者看到結果)。
 */
export type TestSessionKind = "interface-validation";

export type TestSession = {
  id: string;
  kind: TestSessionKind;
  dutId: string;
  dutName: string;
  dutType: DutType;
  interfaces: string[];
  startedAt: number;
  stepDurationMs: number;
  status: "running" | "done";
  result?: InterfaceTestResult;
};

type Store = {
  sessions: TestSession[];
  start: (s: Omit<TestSession, "startedAt" | "status">) => void;
  complete: (id: string, result: InterfaceTestResult) => void;
  remove: (id: string) => void;
};

export const useTestSessionsStore = create<Store>((set) => ({
  sessions: [],
  start: (s) =>
    set((state) => ({
      sessions: [
        ...state.sessions,
        { ...s, startedAt: Date.now(), status: "running" },
      ],
    })),
  complete: (id, result) =>
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === id ? { ...s, status: "done", result } : s,
      ),
    })),
  remove: (id) =>
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== id),
    })),
}));
