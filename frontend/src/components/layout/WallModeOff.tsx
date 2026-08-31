"use client";
import { useEffect } from "react";

/**
 * 明確關閉牆面畫布 —— 左螢幕專用。
 *
 * 左螢幕是 1920×1080 的一般頁面,不走 11520×6480 的縮放畫布。但
 * useWallRegion 為了避開 hydration mismatch,首次 render 一律回 "all",
 * 那一瞬間 AppShell 可能已經掛過 WallModeApplier 並把 wall-mode class 與
 * body 的 transform 設好;等 region 變成 left、AppShell 改走早退分支之後,
 * 那些樣式若沒被清掉,整個面板就會被留在縮小的畫布裡(擠在左上角一小塊)。
 *
 * WallModeApplier 卸載時已經會自己還原,這裡是第二道保險 —— 不論殘留是
 * 怎麼來的(其他分頁、SPA 導航、之後改動),左螢幕都保證是乾淨的。
 */
export function WallModeOff() {
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.remove(
      "wall-mode",
      "wall-region",
      "wall-region-center",
      "wall-region-right",
      "bezels-hidden",
    );
    body.style.transform = "";
    body.style.transformOrigin = "";
  }, []);
  return null;
}
