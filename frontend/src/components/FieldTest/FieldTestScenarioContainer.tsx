"use client";
import { useEffect } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { useFieldScenarioStore } from "@/stores/fieldScenarioStore";
import { useIsWallMode } from "@/stores/wallModeStore";
import type { FieldScenarioId } from "@/types/fieldTest";

import { FieldTestWall } from "./FieldTestWall";

/**
 * 場域測試情境(室外 UAV / 室內 AMR)合在一頁,由標題下方的按鈕切換
 * (FieldScenarioSwitch,渲染在 WallWarRoomLayout 的 topbar)。
 *
 * `initial`:左螢幕若指定舊的 /outdoor-scenario、/indoor-scenario,就用那個情境開場;
 * 合併頁 /smart-network 一律從室外開始。規劃只有中牆版面,一般模式先提示切到電視牆。
 */
export function FieldTestScenarioContainer({ initial }: { initial: FieldScenarioId }) {
  const isWall = useIsWallMode();
  const scenario = useFieldScenarioStore((s) => s.scenario);
  const setScenario = useFieldScenarioStore((s) => s.setScenario);
  const setActive = useFieldScenarioStore((s) => s.setActive);

  useEffect(() => {
    setScenario(initial);
  }, [initial, setScenario]);

  // 切換鈕只在牆上這個畫面出現;離開就收掉
  useEffect(() => {
    if (!isWall) return;
    setActive(true);
    return () => setActive(false);
  }, [isWall, setActive]);

  if (!isWall) {
    return <EmptyState message="智慧網路測試情境目前只有電視牆版面,請按右上角「電視牆」切換" />;
  }
  return <FieldTestWall scenario={scenario} />;
}
