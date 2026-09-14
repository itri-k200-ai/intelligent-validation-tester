"use client";
import { EmptyState } from "@/components/common/EmptyState";
import { useIsWallMode } from "@/stores/wallModeStore";

import { OutdoorWall } from "./OutdoorWall";

/**
 * 室外 UAV 情境。規劃只有中牆版面,一般模式先提示切到電視牆。
 */
export function OutdoorScenarioContainer() {
  const isWall = useIsWallMode();
  if (!isWall) {
    return <EmptyState message="室外 UAV 情境目前只有電視牆版面,請按右上角「電視牆」切換" />;
  }
  return <OutdoorWall />;
}
