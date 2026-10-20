"use client";
import Hls from "hls.js";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { directHlsFor } from "@/lib/fieldCameras";

/** 斷線(或來源還沒起來)之後隔多久重試;牆是整天掛著的,設備恢復要能自己接回來 */
const RETRY_MS = 10_000;
/** 直連幾秒內沒出畫面就改走我們的轉送(連不到場域網段時,請求常常是卡著不回) */
const DIRECT_TIMEOUT_MS = 8_000;

/**
 * 場域攝影機的 HLS 一格(中牆與 /field 共用),來源是我們自己的 mediamtx(/hls/field-*)。
 *
 * 跟 Site/HlsPlayer 的差別:那支是管理頁用的(有控制列、文字提示);這支是展示用 ——
 * 不顯示控制列、畫面填滿整格、出畫面前轉圈、斷了自己重連。
 *
 * ⚠ 室外 52 館屋頂那支是 H.265(HEVC)720p。瀏覽器不能解 H.265 時(Firefox、沒有硬體解碼的電腦),
 *   hls.js 會回 manifestIncompatibleCodecsError —— 這時直接講原因,不要一直轉圈讓人以為在載入。
 */
export function FieldHlsVideo({
  src,
  badge,
  spinner,
  messageClassName = "text-xs",
  preferDirect = true,
}: {
  src: string;
  /**
   * 先試直連場域端(預設,電視牆用)。/field 多半是從外網看,連不到場域網段,
   * 先試直連只是白等 —— 給 false 一開始就走我們的轉送。
   */
  preferDirect?: boolean;
  /** 右上角的 LIVE / 回放標籤(牆面與 /field 的樣式不同,由外面給) */
  badge?: ReactNode;
  /** 轉圈的樣子(同上) */
  spinner: ReactNode;
  messageClassName?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported">("loading");
  const [attempt, setAttempt] = useState(0);
  // 先直連場域端(見 lib/fieldCameras 的 directHlsFor);失敗或太久沒畫面就改走轉送,
  // 之後這一格就一直用轉送(換了來源才重新試直連)
  const direct = preferDirect ? directHlsFor(src) : null;
  const [relay, setRelay] = useState(!direct);
  useEffect(() => setRelay(!(preferDirect && directHlsFor(src))), [src, preferDirect]);
  const active = relay || !direct ? src : direct;
  const viaDirect = active !== src;

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setState("loading");
    // 直連太久沒出畫面:改走轉送
    const giveUp = viaDirect ? window.setTimeout(() => setRelay(true), DIRECT_TIMEOUT_MS) : undefined;
    let retry: number | undefined;
    const again = () => {
      setState("loading");
      retry = window.setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
    };
    const onReady = () => {
      window.clearTimeout(giveUp);
      setState("ready");
    };
    video.addEventListener("loadeddata", onReady);

    // Safari(含 iPhone):原生 HLS,也原生支援 H.265
    if (!Hls.isSupported() && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = active;
      const onError = () => (viaDirect ? setRelay(true) : again());
      video.addEventListener("error", onError);
      void video.play().catch(() => {});
      return () => {
        window.clearTimeout(retry);
        window.clearTimeout(giveUp);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onError);
        video.removeAttribute("src");
        video.load();
      };
    }

    if (!Hls.isSupported()) {
      setState("unsupported");
      return () => video.removeEventListener("loadeddata", onReady);
    }

    const hls = new Hls({
      // mediamtx 是「有人看才去拉來源」,頭幾秒播放清單會 404,讓 hls.js 多等一下。
      // 直連時少試幾次:連不到場域網段就快點換轉送
      manifestLoadingMaxRetry: viaDirect ? 1 : 10,
      manifestLoadingTimeOut: viaDirect ? 5000 : 10000,
      manifestLoadingRetryDelay: 1000,
      levelLoadingMaxRetry: 10,
      fragLoadingMaxRetry: 6,
      lowLatencyMode: true,
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
        // 解不了 H.265 跟走哪條路無關(轉送也是同一個編碼),不要再換轉送
        window.clearTimeout(giveUp);
        hls.destroy();
        setState("unsupported");
        return;
      }
      if (!data.fatal) return;
      // 影像解碼出錯先試著救一次;其他(網路斷了、來源不見)整個重來
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) return hls.recoverMediaError();
      hls.destroy();
      // 直連失敗(連不到場域網段等):改走轉送;轉送也失敗才照舊隔一段時間重試
      if (viaDirect) setRelay(true);
      else again();
    });
    hls.loadSource(active);
    hls.attachMedia(video);
    return () => {
      window.clearTimeout(retry);
      window.clearTimeout(giveUp);
      hls.destroy();
      video.removeEventListener("loadeddata", onReady);
    };
  }, [active, viaDirect, attempt]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      <video ref={ref} className="h-full w-full object-cover" autoPlay muted playsInline />
      {state === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="等待影像">
          {spinner}
        </div>
      )}
      {state === "unsupported" && (
        <div className={`absolute inset-0 flex items-center justify-center px-4 text-center text-white/60 ${messageClassName}`}>
          這個瀏覽器無法播放 H.265 影像,請改用 Chrome、Edge 或 Safari
        </div>
      )}
      {badge}
    </div>
  );
}
