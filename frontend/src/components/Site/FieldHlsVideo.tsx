"use client";
import Hls from "hls.js";
import { useEffect, useRef, useState, type ReactNode } from "react";

/** 斷線(或來源還沒起來)之後隔多久重試;牆是整天掛著的,設備恢復要能自己接回來 */
const RETRY_MS = 10_000;

/**
 * 場域攝影機的 HLS 一格(中牆與 /field 共用),來源是我們自己的 mediamtx(/hls/field-*)。
 *
 * 跟 Site/HlsPlayer 的差別:那支是管理頁用的(有控制列、文字提示);這支是展示用 ——
 * 不顯示控制列、畫面填滿整格、出畫面前轉圈、斷了自己重連。
 *
 * ⚠ 室外 52 館屋頂那支是 H.265(HEVC)4K。瀏覽器不能解 H.265 時(Firefox、沒有硬體解碼的電腦),
 *   hls.js 會回 manifestIncompatibleCodecsError —— 這時直接講原因,不要一直轉圈讓人以為在載入。
 */
export function FieldHlsVideo({
  src,
  badge,
  spinner,
  messageClassName = "text-xs",
}: {
  src: string;
  /** 右上角的 LIVE / 回放標籤(牆面與 /field 的樣式不同,由外面給) */
  badge?: ReactNode;
  /** 轉圈的樣子(同上) */
  spinner: ReactNode;
  messageClassName?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "unsupported">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    setState("loading");
    let retry: number | undefined;
    const again = () => {
      setState("loading");
      retry = window.setTimeout(() => setAttempt((a) => a + 1), RETRY_MS);
    };
    const onReady = () => setState("ready");
    video.addEventListener("loadeddata", onReady);

    // Safari(含 iPhone):原生 HLS,也原生支援 H.265
    if (!Hls.isSupported() && video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      const onError = () => again();
      video.addEventListener("error", onError);
      void video.play().catch(() => {});
      return () => {
        window.clearTimeout(retry);
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
      // mediamtx 是「有人看才去拉來源」,頭幾秒播放清單會 404,讓 hls.js 多等一下
      manifestLoadingMaxRetry: 10,
      manifestLoadingRetryDelay: 1000,
      levelLoadingMaxRetry: 10,
      fragLoadingMaxRetry: 6,
      lowLatencyMode: true,
    });
    hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_e, data) => {
      if (data.details === Hls.ErrorDetails.MANIFEST_INCOMPATIBLE_CODECS_ERROR) {
        hls.destroy();
        setState("unsupported");
        return;
      }
      if (!data.fatal) return;
      // 影像解碼出錯先試著救一次;其他(網路斷了、來源不見)整個重來
      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) return hls.recoverMediaError();
      hls.destroy();
      again();
    });
    hls.loadSource(src);
    hls.attachMedia(video);
    return () => {
      window.clearTimeout(retry);
      hls.destroy();
      video.removeEventListener("loadeddata", onReady);
    };
  }, [src, attempt]);

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
