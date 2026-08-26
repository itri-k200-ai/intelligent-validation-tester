"use client";
import { create } from "zustand";

import type { RicSourceId } from "@/config/ricSources";

/** 左螢幕驅動測試後,每個測項的 runningId(輪詢狀態/結果用)。 */
export type WallRunning = {
  testcaseId: string;
  runningId: string;
};

/**
 * 戰情牆「目前檢視」全域狀態。
 *
 * 選擇來自左螢幕(選單/操作台),經 BroadcastChannel + localStorage 跨分頁
 * 廣播過來;中/右牆只「讀」這裡。除了導覽目標 { href, label },也帶
 * RICtester 的識別(dutName / interface / testcaseId)與驅動後的 runnings。
 */
export type WallSelection = {
  href?: string;
  label?: string;
  dutId?: string;
  name?: string;
  type?: string;
  status?: string;
  updatedAt?: string;
  // RICtester(adapter)識別。source 指出這個 DUT 屬於哪一套 tester
  // (Near/Non 是獨立部署),中/右牆要用它決定打哪一套的 API。
  source?: RicSourceId;
  dutName?: string;
  interface?: string;
  testcaseId?: string;
  // 左螢幕按「執行測試」後的每測項 runningId + 起跑時間
  runnings?: WallRunning[];
  runStartedAt?: string;
};

type State = {
  selection: WallSelection | null;
  /** WS 是否連上,給牆面顯示連線狀態用。 */
  connected: boolean;
  setSelection: (s: WallSelection | null) => void;
  setConnected: (v: boolean) => void;
};

export const useWallSelectionStore = create<State>((set) => ({
  selection: null,
  connected: false,
  setSelection: (selection) => set({ selection }),
  setConnected: (connected) => set({ connected }),
}));
