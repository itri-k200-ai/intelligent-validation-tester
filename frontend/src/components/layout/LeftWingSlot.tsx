"use client";
import { useEffect, type ReactNode } from "react";

import { useLeftWingSlotStore } from "@/stores/leftWingSlotStore";

/**
 * 把內容註冊到左副牆 nav 下方的 page-context 區塊。
 * 卸載時自動清空,layout 顯示 placeholder。
 */
export function LeftWingSlot({ children }: { children: ReactNode }) {
  useEffect(() => {
    useLeftWingSlotStore.getState().setContent(children);
    return () => useLeftWingSlotStore.getState().setContent(null);
  });

  return null;
}
