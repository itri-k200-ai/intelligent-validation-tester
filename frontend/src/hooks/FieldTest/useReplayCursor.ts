"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ReplayFrame } from "@/hooks/FieldTest/useFieldTestReplay";
import type { FieldRun, FieldSample } from "@/types/fieldTest";

/**
 * 歷史回放的播放游標 —— 影像、數值卡、地圖標記共用同一個時間點。
 *
 * 播放的「每一格」有兩種來源:
 *  - 室內:上游存的逐格 JPEG(每 0.7 秒一張、28 張),以影像為準。
 *  - 室外:平台一張都沒存(replay 的 n_frames 一直是 0),改拿樣本自己當格。
 *    路徑、進度條、數值卡照樣一起重播,只是少了影像那一格。
 *
 * 不論哪一種,量測樣本都是另一套、筆數不一樣,所以不能用序號對,要靠絕對時間 wall:
 * 游標推進到第 n 格時,找出 wall 最接近那一格的樣本,數值與位置就用那一筆。
 *
 * 播到底從頭再來 —— 牆是長時間掛著的,停在最後一格看起來像當掉。
 */
export function useReplayCursor(
  frames: ReplayFrame[] | null,
  periodS: number | null,
  runs: FieldRun[],
  /**
   * 沒有影像時要不要改用樣本的時間軸播放(室外)。
   * 驗測正在跑時要傳 false —— 那時牆面本來就在即時更新,不該被截成回放。
   */
  fromSamples = false,
) {
  // 兩趟的樣本攤平 —— 回放橫跨優化前與優化後,不能只看其中一趟
  const flat = useMemo(
    () => runs.flatMap((r) => r.samples ?? []).filter((s) => s.wall != null),
    [runs],
  );

  const steps: ReplayFrame[] = useMemo(() => {
    if (frames?.length) return frames;
    if (!fromSamples || flat.length < 2) return [];
    return [...flat]
      .sort((a, b) => (a.wall as number) - (b.wall as number))
      .map((s, i) => ({ i, phase: "", wall: s.wall }));
  }, [frames, fromSamples, flat]);

  const total = steps.length;
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

  const sample: FieldSample | null = useMemo(() => {
    const wall = steps[at]?.wall;
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
  }, [steps, at, flat]);

  // wall:目前播到的絕對時間 —— 每支鏡頭各自拿它去找「自己最接近這個時刻的那一格」
  // (各鏡頭錄的時段與張數不一樣,不能共用同一個序號,見 lib/fieldCameras 的 frameAt)
  return { at, sample, phase: steps[at]?.phase || null, total, wall: steps[at]?.wall ?? null };
}
