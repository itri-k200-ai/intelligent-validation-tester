"use client";
import { useEffect, useMemo, useState } from "react";

import type { ReplayCamera } from "@/hooks/FieldTest/useFieldTestReplay";
import type { FieldScenarioId } from "@/types/fieldTest";

/** 目前這張之後先載入幾張 —— 播到時已經在快取裡,不會出現空白 */
const LOOKAHEAD = 2;

/**
 * 歷史驗測的影像回放 —— 把平台存下來的逐格畫面依原本的間隔播成動畫。
 *
 * 不是影片,是一連串 JPEG(實測單張約 130 KB),做法是把圖疊著、用 opacity 切換。
 * 播放游標由上層的 useReplayCursor / frameAt 提供(數值卡與地圖標記要跟影像同步)。
 *
 * 載入策略(回放時「某幾格要等一陣子才出現」的修正):
 *  - 網址帶 run_id:後端就不用每張圖都先去平台查「現在顯示哪一次」(實測首位元組
 *    0.17 秒 → 0.03 秒),也讓快取分得出是哪一次 —— 沒帶的話換看別筆歷史時,
 *    同一個網址會拿到上一筆快取的畫面。
 *  - 不一次掛上全部圖片:一次回放四支鏡頭約 70 張,HTTP/1.1 每個網站只開 6 條連線,
 *    「現在要顯示的那張」會排在幾十張後面。改成只掛目前這張與後面 LOOKAHEAD 張,
 *    播到哪載到哪;掛過的留著(第二輪起直接用快取)。
 *  - 目前這張還沒載完時,先繼續顯示上一張載好的,不要整格變黑。
 */
export function ReplayPlayer({
  scenario,
  camera,
  at,
}: {
  scenario: FieldScenarioId;
  camera: ReplayCamera;
  /** 目前播到第幾格(這支鏡頭自己的序號,見 lib/fieldCameras 的 frameAt) */
  at: number;
}) {
  const frames = camera.frames;
  const total = frames.length;

  const urls = useMemo(() => {
    const q = camera.runId ? `?run_id=${encodeURIComponent(camera.runId)}` : "";
    return frames.map((f) => `/api/field-tests/replay/${scenario}/${camera.key}/${f.i}.jpg${q}`);
  }, [frames, scenario, camera.key, camera.runId]);

  // 已經掛上 / 已經載完的序號。換了鏡頭或換了一次驗測就重來
  const [mounted, setMounted] = useState<Set<number>>(() => new Set());
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set());
  useEffect(() => {
    setMounted(new Set());
    setLoaded(new Set());
  }, [urls]);
  useEffect(() => {
    if (!total) return;
    setMounted((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (let k = 0; k <= LOOKAHEAD; k++) {
        const i = (at + k) % total;
        if (!next.has(i)) {
          next.add(i);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [at, total, urls]);

  if (!total) return null;

  // 要顯示的那張:目前這張載好了就用它,否則往回找最近一張載好的
  let shown: number | null = null;
  for (let k = 0; k < total; k++) {
    const i = (at - k + total) % total;
    if (loaded.has(i)) {
      shown = i;
      break;
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {urls.map((url, i) =>
        mounted.has(i) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt={`${camera.name} 回放第 ${i + 1} 格`}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: i === shown ? 1 : 0 }}
            onLoad={() => setLoaded((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))}
          />
        ) : null,
      )}
      {shown === null && (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="載入回放影像">
          <span className="video-spinner" />
        </div>
      )}
      {/* 標明這是回放不是即時 —— 牆上兩者長得一樣,不標會誤會車子還在跑。
          只寫「回放」:趟次與第幾張不標(依現場回饋;趟次另外看進度條的階段) */}
      <span className="field-replay-badge">回放</span>
    </div>
  );
}
