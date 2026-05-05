"use client";
import type { ReactNode } from "react";
import { create } from "zustand";

/**
 * 右副牆下半部三格的 slot:
 *   dut     待測物
 *   equip   測試設備
 *   method  測試方法
 *
 * 頁面用 `<RightWingSlots>` 元件註冊內容,layout 在電視牆模式下從 store 讀
 * 出來渲染。沒設的格子會 fallback 到預設的 placeholder(由 layout 處理)。
 */
export type RightWingSlotsValue = {
  dut?: ReactNode;
  equip?: ReactNode;
  method?: ReactNode;
};

type State = {
  slots: RightWingSlotsValue;
  setSlots: (slots: RightWingSlotsValue) => void;
};

export const useRightWingSlotsStore = create<State>((set) => ({
  slots: {},
  setSlots: (slots) => set({ slots }),
}));
