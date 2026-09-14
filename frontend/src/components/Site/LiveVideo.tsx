"use client";
import { Maximize2, Pause, Play, Video, Volume2 } from "lucide-react";

import { HlsPlayer } from "./HlsPlayer";

/**
 * 牆面上的一格即時影像:有 HLS 串流就播;沒有就畫一個假播放器(保留 LIVE
 * 標籤與控制列),讓沒串流時的版面跟有串流時一致。
 */
export function LiveVideo({
  src,
  emptyText = "尚無攝影機串流",
}: {
  src?: string | null;
  emptyText?: string;
}) {
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
