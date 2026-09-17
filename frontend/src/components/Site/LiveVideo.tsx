"use client";
import { Maximize2, Pause, Play, Video, Volume2 } from "lucide-react";

import { HlsPlayer } from "./HlsPlayer";

/**
 * 牆面上的一格即時影像:有 HLS 串流就播;沒有就畫一個假播放器(保留 LIVE
 * 標籤與控制列),讓沒串流時的版面跟有串流時一致。
 */
/** MJPEG(車載影像)還是 HLS(場域固定攝影機)—— 看路徑就分得出來 */
function isMjpeg(src: string) {
  return /\/camera\/[^/]+\/(stream|snapshot)\b/.test(src) || /\.mjpe?g($|\?)/.test(src);
}

export function LiveVideo({
  src,
  emptyText = "尚無攝影機串流",
}: {
  src?: string | null;
  emptyText?: string;
}) {
  // 車載影像是 MJPEG(外部平台 B6,經後端 /api/field-tests/camera/… 代理):
  // 直接用 <img> 吃 multipart 串流,不進 hls.js。元件卸載瀏覽器就會斷線 ——
  // 上游同時只允許 3 路,不看要真的移除元素。
  if (src && isMjpeg(src)) {
    return (
      <div className="relative h-full w-full overflow-hidden">
        <img className="h-full w-full object-cover" src={src} alt="車載即時影像" />
        <div className="video-live-badge">
          <span className="video-live-dot" /> LIVE
        </div>
      </div>
    );
  }
  if (src) return <HlsPlayer src={src} />;
  return (
    <div className="video-placeholder">
      <div className="video-screen">
        <div className="video-empty">
          <Video className="w-20 h-20" strokeWidth={1.25} />
          <p>{emptyText}</p>
        </div>
        <div className="video-live-badge">
          <span className="video-live-dot" /> LIVE
        </div>
      </div>
      <div className="video-controls">
        <button type="button" aria-label="play"><Play className="w-5 h-5" /></button>
        <button type="button" aria-label="pause"><Pause className="w-5 h-5" /></button>
        <span className="video-time">00:00</span>
        <div className="video-timeline"><div className="video-progress" /></div>
        <span className="video-time">--:--</span>
        <button type="button" aria-label="volume"><Volume2 className="w-5 h-5" /></button>
        <button type="button" aria-label="fullscreen"><Maximize2 className="w-5 h-5" /></button>
      </div>
    </div>
  );
}
