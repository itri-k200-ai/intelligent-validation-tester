"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type WallModeState = {
  isWall: boolean;
  /** 是否顯示 bezel 視覺指示線(電視牆模式下的開發參考用)。 */
  showBezels: boolean;
  toggle: () => void;
  setWall: (v: boolean) => void;
  toggleBezels: () => void;
};

/**
 * 電視牆模式 — 整體 UI 放大、間距加大、bezel safe zone 啟用。
 * 目標解析度 11520×3240(6×3 顆 1920×1080 螢幕拼接,單條 HDMI 直出)。
 *
 * ── 現在一律是電視牆模式 ──────────────────────────────────────────
 * 這套系統只在牆上用,不再需要「一般模式」,所以 isWall 固定 true、
 * toggle 不做事,topbar 的切換鈕也拿掉了。AppShell / Sidebar / SiteDetail
 * 等等的非牆分支**刻意保留**(走不到,但改回來只要動這個檔),之後若又需要
 * 筆電版面,把 isWall 改回可切換即可。
 *
 * ⚠ isWall 不進 persist。之前的版本會把它寫進 localStorage,舊瀏覽器上存的
 *   可能是 false —— 若照舊 persist,rehydrate 會用那個舊值蓋掉這裡的 true,
 *   使用者就會卡在一般模式。只留 showBezels。
 */
export const useWallModeStore = create<WallModeState>()(
  persist(
    (set) => ({
      isWall: true,
      showBezels: true,
      // 只保留電視牆模式 —— 保留這支是為了不動其他呼叫端的介面。
      toggle: () => {},
      setWall: () => {},
      toggleBezels: () => set((s) => ({ showBezels: !s.showBezels })),
    }),
    {
      name: "ivt-wall-mode",
      partialize: (s) => ({ showBezels: s.showBezels }),
    },
  ),
);

export const useIsWallMode = () => useWallModeStore((s) => s.isWall);
