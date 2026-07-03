"use client";
import { create } from "zustand";

/**
 * 戰情牆「目前檢視」全域狀態。
 *
 * 拆分後,選擇來自**另一個 app(左螢幕,別團隊)**,經由後端
 * `POST /api/selection/current/` 寫入、`WS /ws/selection/` 廣播過來。
 * 中/右牆只「讀」這裡,不自己改 —— 真實來源是後端 Redis。
 *
 * 主要形態是導覽目標 `{ href, label }`(左 app 選單點的那一頁);
 * 也相容舊的 DUT 形態 `{ dutId, name, type, status }`。
 */
export type WallSelection = {
  href?: string;
  label?: string;
  dutId?: string;
  name?: string;
  type?: string;
  status?: string;
  updatedAt?: string;
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
