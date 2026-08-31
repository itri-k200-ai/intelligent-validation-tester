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
 * 選擇來自左螢幕,寫進 IVT 後端的共享狀態(Redis),再由後端經
 * /ws/selection/ 推給中牆;中牆只「讀」這裡,不寫。右副牆是靜態內容,
 * 不看這裡。
 *
 * href 現在的語意是「要顯示哪種內容」而不是導覽目標 —— 中牆固定停在
 * /wall,由該頁依這個值切換渲染。另外帶 RICtester 的識別
 * (source / dutName / interface / testcaseId)與 runnings(左螢幕呼叫
 * tester adapter 驅動測試後回填,中牆據此輪詢狀態與判決)。
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
  /** 選中的案例;沒帶代表看整台 DUT 的所有案例。 */
  scenarioId?: string;
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
