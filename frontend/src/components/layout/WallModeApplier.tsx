"use client";
import { useEffect } from "react";

import { WALL_REGIONS } from "@/config/wallRegion";
import { useWallRegion } from "@/hooks/Wall/useWallRegion";
import { useIsWallMode, useWallModeStore } from "@/stores/wallModeStore";

/**
 * 掛 `wall-mode` class 到 <html>,並用 JS 算 fit-to-viewport 縮放。
 *
 * 單螢幕拆分:?wall=center|right 時,只把畫布上「該區」裁切 + 縮放 + 置中到
 * 整個視窗(其餘用 overflow:hidden 裁掉)。?wall=all(預設)整塊縮放預覽。
 * region=left 由 AppShell 走 WallLeftSimulator,不會用到這裡。
 */
export function WallModeApplier() {
  const region = useWallRegion();
  const isWall = useIsWallMode();
  const setWall = useWallModeStore((s) => s.setWall);
  const showBezels = useWallModeStore((s) => s.showBezels);
  const isCrop = region === "center" || region === "right";
  const active = isWall || isCrop;

  // region 是 center/right 時把 store 也設成 wall,讓元件裡 useIsWallMode() 一致。
  useEffect(() => {
    if (isCrop && !isWall) setWall(true);
  }, [isCrop, isWall, setWall]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    // 還原成非牆模式。除了 active=false 之外,**元件卸載時也必須跑** ——
    // useWallRegion 首次 render 回 "all",若 isWall 為真就會先掛上這個元件、
    // 設好 11520×6480 畫布與 scale();等 region 變成 left 之後 AppShell 改走
    // 早退分支、這個元件被卸載,當時若不還原,左螢幕就會被留在那個縮小的
    // 畫布裡(症狀:整個面板擠在左上角一小塊)。
    const reset = () => {
      root.classList.remove("wall-mode", "wall-region", "wall-region-center", "wall-region-right");
      body.style.transform = "";
      body.style.transformOrigin = "";
    };

    if (!active) {
      reset();
      return;
    }
    root.classList.add("wall-mode");
    root.classList.toggle("wall-region", isCrop);
    root.classList.toggle("wall-region-center", region === "center");
    root.classList.toggle("wall-region-right", region === "right");

    const r = WALL_REGIONS[region] ?? WALL_REGIONS.all;
    const apply = () => {
      const scale = Math.min(window.innerWidth / r.w, window.innerHeight / r.h);
      if (!isCrop) {
        // 整塊:scale 置中,預設 transform-origin。
        body.style.transformOrigin = "";
        body.style.transform = `scale(${scale})`;
        return;
      }
      // 單區:把 (r.x, r.y) 對到視窗左上,再置中留白,並裁掉其餘畫布。
      const offsetX = (window.innerWidth - r.w * scale) / 2;
      const offsetY = (window.innerHeight - r.h * scale) / 2;
      body.style.transformOrigin = "0 0";
      body.style.transform =
        `translate(${offsetX - r.x * scale}px, ${offsetY - r.y * scale}px) scale(${scale})`;
    };
    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      reset();
    };
  }, [active, isCrop, region]);

  useEffect(() => {
    document.documentElement.classList.toggle("bezels-hidden", active && !showBezels);
    return () => document.documentElement.classList.remove("bezels-hidden");
  }, [active, showBezels]);

  return null;
}
