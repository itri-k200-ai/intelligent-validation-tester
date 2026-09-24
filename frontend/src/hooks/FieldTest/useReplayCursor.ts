"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ReplayFrame } from "@/hooks/FieldTest/useFieldTestReplay";
import type { FieldRun, FieldSample } from "@/types/fieldTest";

/**
 * 歷史回放的播放游標 —— 影像、數值卡、地圖標記共用同一個時間點。
 *
 * 影像是逐格 JPEG(每 0.7 秒一張、28 張),量測樣本是另一套(兩趟共 100 多筆),
 * **兩者筆數不一樣**,所以不能用序號對,要靠絕對時間 wall:游標推進到第 n 格時,
 * 找出 wall 最接近那一格的樣本,數值與位置就用那一筆。
 *
 * 播到底從頭再來 —— 牆是長時間掛著的,停在最後一格看起來像當掉。
 */
export function useReplayCursor(
  frames: ReplayFrame[] | null,
  periodS: number | null,
  runs: FieldRun[],
) {
  const total = frames?.length ?? 0;
  const [at, setAt] = useState(0);
  // periodS 是上游錄影的間隔;沒給就用 0.7 秒(實測值)。太快會看不清,設下限。
  const stepMs = Math.max(200, Math.round((periodS ?? 0.7) * 1000));

  useEffect(() => {
    setAt(0);
  }, [total]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (total <= 1) return;
    timer.current = setInterval(() => setAt((i) => (i + 1) % total), stepMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [total, stepMs]);

  // 兩趟的樣本攤平 —— 回放橫跨優化前與優化後,不能只看其中一趟
  const flat = useMemo(
    () => runs.flatMap((r) => r.samples ?? []).filter((s) => s.wall != null),
    [runs],
  );

  const sample: FieldSample | null = useMemo(() => {
    const wall = frames?.[at]?.wall;
    if (wall == null || flat.length === 0) return null;
    let best = flat[0];
    let bestGap = Math.abs((best.wall as number) - wall);
    for (const s of flat) {
      const gap = Math.abs((s.wall as number) - wall);
      if (gap < bestGap) {
        best = s;
        bestGap = gap;
      }
    }
    return best;
  }, [frames, at, flat]);

  return { at, sample, phase: frames?.[at]?.phase ?? null, total };
}
