"use client";
import { useEffect } from "react";

import { WALL_REGION, WALL_REGIONS } from "@/config/wallRegion";
import { useIsWallMode, useWallModeStore } from "@/stores/wallModeStore";

/**
 * Applies the `wall-mode` class to <html> and computes the fit-to-viewport
 * scale via JS (CSS `transform: scale(min(calc(100vw / 11520), ...))` doesn't
 * work because length÷number stays a length, not the unitless number scale()
 * needs).
 *
 * 單螢幕拆分:NEXT_PUBLIC_WALL_REGION=center|right 時,只把畫布上「該區」
 * 那塊裁切 + 縮放 + 置中到整個視窗(其餘用 overflow:hidden 裁掉),讓中牆 /
 * 右翼各自跑在自己的 port。region=all(預設)維持原本整塊縮放預覽。
 */
export function WallModeApplier() {
  const isWall = useIsWallMode();
  const setWall = useWallModeStore((s) => s.setWall);
  const showBezels = useWallModeStore((s) => s.showBezels);
  // center/right 一律進 wall-mode(那才是拆出來要看的東西),不看 toggle。
  const active = isWall || WALL_REGION !== "all";

  // region build 把 store 也設成 wall,讓元件裡 useIsWallMode() 一致為 true
  // (否則頁面可能 render 成平面版)。各 port 各自的 localStorage,不互相影響。
  useEffect(() => {
    if (WALL_REGION !== "all" && !isWall) setWall(true);
  }, [isWall, setWall]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (!active) {
      root.classList.remove("wall-mode", "wall-region", "wall-region-center", "wall-region-right");
      body.style.transform = "";
      body.style.transformOrigin = "";
      return;
    }
    root.classList.add("wall-mode");
    // region 模式掛 wall-region + wall-region-<name>:CSS 用它隱藏非該區的牆、
    // 清掉 letterbox 的翼色背景。裁切靠 html.wall-mode 既有的 overflow:hidden。
    root.classList.toggle("wall-region", WALL_REGION !== "all");
    root.classList.toggle("wall-region-center", WALL_REGION === "center");
    root.classList.toggle("wall-region-right", WALL_REGION === "right");

    const r = WALL_REGIONS[WALL_REGION] ?? WALL_REGIONS.all;
    const apply = () => {
      const scale = Math.min(
        window.innerWidth / r.w,
        window.innerHeight / r.h,
      );
      if (WALL_REGION === "all") {
        // 整塊:維持原本行為(scale 置中,預設 transform-origin)。
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
    return () => window.removeEventListener("resize", apply);
  }, [active]);

  // Toggle bezel-overlay visibility independently of wall mode itself.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "bezels-hidden",
      active && !showBezels,
    );
  }, [active, showBezels]);

  return null;
}
