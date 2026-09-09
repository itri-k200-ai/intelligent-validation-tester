"use client";
import { create } from "zustand";

import type { WallRunning } from "./wallSelectionStore";

export type WallRunEntry = {
  runnings: WallRunning[];
  startedAt: string;
  /** 按執行當下「該介面既有最新 log 的 uuid」;探針框只顯示 uuid 不同的新 log,
   *  用來把上一次的日誌清掉(伺服器身分比對,不靠時鐘)。null = 之前沒有 log。*/
  baselineLogUuid?: string | null;
};

/**
 * 每個「DUT + 介面」各自保存最近一次執行(runnings + 起跑時間)。
 * 跟「選擇導覽」脫鉤:左螢幕切換 DUT/介面時不會清掉正在跑的 run,
 * 切回原本的介面仍看得到它的進度/結果。
 *
 * key = `${dutName}|${interface}`(介面可空 → 全部)。
 *
 * 刻意「不」persist:重整後就是乾淨狀態(沒有幽靈 run / 上一次結果),
 * 要看結果就重新執行。避免重整後重新輪詢舊 runningId 拿快取結果、卻沒有
 * 對應的新探針日誌而卡住。
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
