"use client";
import { useEffect } from "react";

import { EmptyState } from "@/components/common/EmptyState";
import { useFieldTestActive } from "@/hooks/FieldTest/useFieldTestActive";
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

  // 自動跳轉:哪一邊「最後一次操作」比較晚就顯示哪一邊。
  //
  // 操作有三種,一律換算成「多久以前」再比,不比絕對時刻 —— 驗測與指定的時間來自
  // 後端的時鐘、手動按鈕來自瀏覽器,兩台機器有時差就會比錯。後端一起回 now,
  // 相減之後兩邊的「幾秒前」才是可比的。
  const { active } = useFieldTestActive();
  const manualAt = useFieldScenarioStore((s) => s.manualAt);
  useEffect(() => {
    if (!active?.scenarios) return;
    let best: { id: FieldScenarioId; ago: number } | null = null;
    for (const [id, v] of Object.entries(active.scenarios)) {
      if (!v) continue;
      // 這個情境最後一次操作:開跑與被指定,取較晚的。
      // 跑完的那一筆**仍然算**一次操作 —— 不然驗測一結束,這一邊的「最後一次操作」
      // 就塌回更早的歷史指定,牆面會自己跳回另一邊去(跟「跑完就停住」相反)。
      const at = Math.max(v.runStartedAt ?? 0, v.pinnedAt ?? 0);
      if (!at) continue;
      const ago = active.now - at;
      if (!best || ago < best.ago) best = { id: id as FieldScenarioId, ago };
    }
    if (!best) return;
    // 現場剛按過按鈕就以它為準 —— 它也是一次操作
    const manualAgo = manualAt === null ? Infinity : (performance.now() - manualAt) / 1000;
    if (manualAgo < best.ago) return;
    if (best.id !== scenario) setScenario(best.id);
  }, [active, manualAt, scenario, setScenario]);

  if (!isWall) {
    return <EmptyState message="智慧網路測試情境目前只有電視牆版面,請按右上角「電視牆」切換" />;
  }
  return <FieldTestWall scenario={scenario} />;
}
