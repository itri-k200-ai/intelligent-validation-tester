"use client";
import { useEffect, useMemo, useState } from "react";

import type { ReplayCamera } from "@/hooks/FieldTest/useFieldTestReplay";
import { frameAt, replayFrameUrl, replayMaster } from "@/lib/fieldCameras";
import type { FieldScenarioId } from "@/types/fieldTest";

/** 預載最多等多久(毫秒)—— 平台慢或某支鏡頭載不到時,照樣開始播,不要整面卡住 */
const PRELOAD_TIMEOUT_MS = 8000;

/**
 * 回放開始前,先把每支鏡頭「第一格要顯示的那張」載好(依現場要求:等資料都到了再開始播,
 * 不要數據先跑、影像慢慢才出來)。回傳 true = 可以開始播。
 *
 * 用跟 ReplayPlayer 一模一樣的網址(replayFrameUrl),後端回 Cache-Control: max-age=86400,
 * 所以這裡載過的,回放元件掛上去時直接用快取、瞬間就出畫面。
 * 載失敗也算「有結果」(那一格回放元件自己會重試),最多等 PRELOAD_TIMEOUT_MS。
 */
export function useReplayPreload(scenario: FieldScenarioId, cams: ReplayCamera[]): boolean {
  const urls = useMemo(() => {
    const master = replayMaster(cams);
    const start = master?.frames[0]?.wall ?? null;
    return cams.flatMap((cam) => {
      if (!cam.frames.length) return [];
      const i = frameAt(cam, start) ?? 0;
      return [replayFrameUrl(scenario, cam, cam.frames[i].i)];
    });
  }, [scenario, cams]);
  const key = urls.join("|");
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    if (!urls.length) return;
    let alive = true;
    let left = urls.length;
    const finish = () => alive && setReadyKey(key);
    const imgs = urls.map((u) => {
      const img = new Image();
      img.onload = img.onerror = () => {
        left -= 1;
        if (left <= 0) finish();
      };
      img.src = u;
      return img;
    });
    const timer = window.setTimeout(finish, PRELOAD_TIMEOUT_MS);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      imgs.forEach((img) => (img.onload = img.onerror = null));
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return !urls.length || readyKey === key;
}
