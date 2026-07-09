"use client";
import { useEffect, useState } from "react";

import { getWallRegion, type WallRegionName } from "@/config/wallRegion";

/**
 * 目前 region(執行時看 URL ?wall=)。SSR 與首次 client render 一律回 "all"
 * (跟 server 一致,避免 hydration mismatch),掛載後再切到真正的 region。
 */
export function useWallRegion(): WallRegionName {
  const [region, setRegion] = useState<WallRegionName>("all");
  useEffect(() => {
    setRegion(getWallRegion());
  }, []);
  return region;
}
