"use client";
import { useEffect } from "react";

import { useIsWallMode, useWallModeStore } from "@/stores/wallModeStore";

const WALL_W = 11520;
// Canvas now includes the wing area folded under the main 6×3 wall:
// 11520 × 6480 = 16:9, fits a 1080p preview at exactly 1/6 scale.
const WALL_H = 6480;

/**
 * Applies the `wall-mode` class to <html> and computes the fit-to-viewport
 * scale via JS (CSS `transform: scale(min(calc(100vw / 11520), ...))` doesn't
 * work because length÷number stays a length, not the unitless number scale()
 * needs).
 */
export function WallModeApplier() {
  const isWall = useIsWallMode();
  const showBezels = useWallModeStore((s) => s.showBezels);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (!isWall) {
      root.classList.remove("wall-mode");
      body.style.transform = "";
      return;
    }
    root.classList.add("wall-mode");

    const apply = () => {
      // Fit the whole canvas (main wall + wings) inside the viewport. On
      // shorter viewports this shrinks the wall horizontally, but nothing
      // gets clipped.
      const scale = Math.min(
        window.innerWidth / WALL_W,
        window.innerHeight / WALL_H,
      );
      body.style.transform = `scale(${scale})`;
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, [isWall]);

  // Toggle bezel-overlay visibility independently of wall mode itself.
  useEffect(() => {
    document.documentElement.classList.toggle(
      "bezels-hidden",
      isWall && !showBezels,
    );
  }, [isWall, showBezels]);

  return null;
}
