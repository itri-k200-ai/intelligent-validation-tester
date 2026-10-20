"use client";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { useFieldTestActive } from "@/hooks/FieldTest/useFieldTestActive";
import { latestOperated, useScenarioAutoFollow } from "@/hooks/FieldTest/useScenarioAutoFollow";
import { useFieldScenarioStore } from "@/stores/fieldScenarioStore";
import { useIsWallMode } from "@/stores/wallModeStore";
import type { FieldScenarioId } from "@/types/fieldTest";

import { FieldTestWall, WallLoading } from "./FieldTestWall";

/** /active 一直沒回(後端不通等):最多等這麼久就先用 initial 開 */
const DECIDE_TIMEOUT_MS = 1000;

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

  // 開頁先等「最後一次操作」是哪一邊(/active,約 0.1 秒)再掛牆面。以前先照 initial 掛,
  // /active 回來才跳 —— 室外那頁會先整份掛起來(3D 地圖、抓資料、預載影格)再拆掉換室內,
  // 白做的那一輪讓牆面晚 2 秒以上才出完整畫面
  const { active } = useFieldTestActive();
  const [decided, setDecided] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setTimedOut(true), DECIDE_TIMEOUT_MS);
    return () => window.clearTimeout(t);
  }, []);
  useEffect(() => {
    if (decided || (!active && !timedOut)) return;
    setScenario(latestOperated(active)?.id ?? initial);
    setDecided(true);
  }, [active, timedOut, decided, initial, setScenario]);

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
  if (!decided) return <WallLoading />;
  return <FieldTestWall scenario={scenario} />;
}
