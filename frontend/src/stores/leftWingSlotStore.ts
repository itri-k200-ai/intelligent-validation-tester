"use client";
import type { ReactNode } from "react";
import { create } from "zustand";

/**
 * 左副牆 nav 下方的 page-context 區塊。每個頁面可以註冊自己的列表 /
 * 詳情內容(像連接介面驗證頁的 DUT 列表)。沒設就 fallback 到 placeholder。
 */
type State = {
  content: ReactNode;
  setContent: (n: ReactNode) => void;
};

export const useLeftWingSlotStore = create<State>((set) => ({
  content: null,
  setContent: (content) => set({ content }),
}));
