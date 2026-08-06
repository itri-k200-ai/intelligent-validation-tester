"use client";
import { create } from "zustand";

import type { WallRunning } from "./wallSelectionStore";

export type WallRunEntry = {
  runnings: WallRunning[];
  startedAt: string;
};

/**
 * 每個「DUT + 介面」各自保存最近一次執行(runnings + 起跑時間)。
 * 跟「選擇導覽」脫鉤:左螢幕切換 DUT/介面時不會清掉正在跑的 run,
 * 切回原本的介面仍看得到它的進度/結果。
 *
 * key = `${dutName}|${interface}`(介面可空 → 全部)。
 */
type State = {
  runsByKey: Record<string, WallRunEntry>;
  setRun: (key: string, entry: WallRunEntry) => void;
};

export const runKey = (dutName?: string | null, iface?: string | null) =>
  `${dutName ?? ""}|${iface ?? ""}`;

export const useWallRunStore = create<State>((set) => ({
  runsByKey: {},
  setRun: (key, entry) =>
    set((s) => ({ runsByKey: { ...s.runsByKey, [key]: entry } })),
}));
