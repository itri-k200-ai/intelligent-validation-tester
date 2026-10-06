"use client";
import { useEffect } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { useScenarioAutoFollow } from "@/hooks/FieldTest/useScenarioAutoFollow";
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

  // 自動跳轉:哪一邊「最後一次操作」比較晚就顯示哪一邊(見 useScenarioAutoFollow)
  useScenarioAutoFollow();

  if (!isWall) {
    // 這個版面固定是電視牆模式(見 wallModeStore),走不到這裡。
    // 一般電腦 / 手機請用 /field(FieldTestResponsive)。
    return <EmptyState message="一般電腦與手機請開 /field" />;
  }
  return <FieldTestWall scenario={scenario} />;
}
