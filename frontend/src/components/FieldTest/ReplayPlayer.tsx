"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ReplayCamera } from "@/hooks/FieldTest/useFieldTestReplay";
import type { FieldScenarioId } from "@/types/fieldTest";

/**
 * 歷史驗測的影像回放 —— 把平台存下來的逐格畫面依原本的間隔播成動畫。
 *
 * 不是影片,是一連串 JPEG(實測每 0.7 秒一張、單張約 130 KB),所以做法是
 * 預先把所有 <img> 都掛上去、用 opacity 切換當前那張:
 *   - 換 src 會有一段空白(瀏覽器重新載入),疊著切就不會閃
 *   - 圖片有 Cache-Control: public,循環播放時不會重抓
 * 張數不多(28 張),全部掛著的記憶體成本可以接受。
 *
 * 播到底就從頭再來 —— 牆是長時間掛著的,停在最後一格看起來像當掉。
 */
export function ReplayPlayer({
  scenario,
  camera,
  periodS,
}: {
  scenario: FieldScenarioId;
  camera: ReplayCamera;
  periodS: number | null;
}) {
  const frames = camera.frames;
  const [at, setAt] = useState(0);
  // periodS 是上游錄影的間隔;沒給就用 0.7 秒(實測值)。太快會看不清,設下限。
  const stepMs = Math.max(200, Math.round((periodS ?? 0.7) * 1000));

  // 換一次驗測(張數變了)就從頭播
  const total = frames.length;
  useEffect(() => {
    setAt(0);
  }, [total, camera.key]);

  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (total <= 1) return;
    timer.current = setInterval(() => setAt((i) => (i + 1) % total), stepMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [total, stepMs]);

  const urls = useMemo(
    () =>
      frames.map(
        (f) => `/api/field-tests/replay/${scenario}/${camera.key}/${f.i}.jpg`,
      ),
    [frames, scenario, camera.key],
  );

  if (!total) return null;
  const phase = frames[at]?.phase;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {urls.map((url, i) => (
        <img
          key={url}
          src={url}
          alt={`${camera.name} 回放第 ${i + 1} 格`}
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200"
          style={{ opacity: i === at ? 1 : 0 }}
        />
      ))}
      {/* 標明這是回放不是即時 —— 牆上兩者長得一樣,不標會誤會車子還在跑 */}
      <span className="field-replay-badge">
        回放{phase ? ` · ${phase}` : ""} {at + 1}/{total}
      </span>
    </div>
  );
}
