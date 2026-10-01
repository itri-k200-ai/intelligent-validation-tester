"use client";
import { useEffect, useState } from "react";
import { Maximize2, Pause, Play, Volume2 } from "lucide-react";

import { HlsPlayer } from "./HlsPlayer";

/**
 * 牆面上的一格即時影像:有 HLS 串流就播;沒有就畫一個假播放器(保留 LIVE
 * 標籤與控制列),讓沒串流時的版面跟有串流時一致。
 */
/**
 * MJPEG 還是 HLS —— 看路徑就分得出來。
 *
 * 後端代理有兩種形狀,兩種都是 MJPEG:
 *   /api/field-tests/camera/<情境>/stream          載具車載
 *   /api/field-tests/camera/by-name/<名稱>/stream  平台登記的固定攝影機
 * 原本只比對得到前者([^/]+ 只吃一段),by-name 那種會被當成 HLS 丟進 hls.js,
 * 畫面就永遠停在「連線中…」。
 */
function isMjpeg(src: string) {
  return (
    /\/camera\/(?:by-name\/)?[^/]+\/(stream|snapshot)\b/.test(src) ||
    /\.mjpe?g($|\?)/.test(src)
  );
}

/**
 * MJPEG 一格:直接用 <img> 吃 multipart 串流,不進 hls.js。
 * 元件卸載瀏覽器就會斷線 —— 上游同時只允許 3 路,不看要真的移除元素。
 *
 * 載不起來就退回佔位畫面:固定攝影機是陸續接上來的,平台還沒登記的名稱會回 404,
 * 不接 onError 的話那一格會變成瀏覽器的破圖。
 */
function MjpegVideo({ src, emptyText }: { src: string; emptyText: string }) {
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  // 換了來源就重新等 —— 驗測一開跑會從回放切成即時,那時還沒有畫面
  useEffect(() => {
    setFailed(false);
    setReady(false);
  }, [src]);
  if (failed) return <LiveVideo src={null} emptyText={emptyText} />;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img
        className="h-full w-full object-cover"
        src={src}
        alt="即時影像"
        onLoad={() => setReady(true)}
        onError={() => setFailed(true)}
      />
      {/* 第一格畫面進來之前先轉圈 —— MJPEG 的 <img> 在收到第一格前是整片空白,
          驅動之後載具還要走到起點,這段空白不標示會看起來像壞了。
          onLoad 在第一格到達時就會觸發。 */}
      {!ready && (
        <div className="video-spin-overlay video-spin-overlay--dim" role="status" aria-label={emptyText}>
          <span className="video-spinner" />
        </div>
      )}
      <div className="video-live-badge">
        <span className="video-live-dot" /> LIVE
      </div>
    </div>
  );
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
  if (src && isMjpeg(src)) return <MjpegVideo src={src} emptyText={emptyText} />;
  if (src) return <HlsPlayer src={src} />;
  return (
    <div className="video-placeholder">
      <div className="video-screen">
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
      {/* 沒有畫面時顯示轉圈,不寫「尚無攝影機串流」—— 牆上多半是鏡頭還沒接上
          或正在重連,寫死一句「沒有」看起來像壞了。文字留給輔助技術用。
          疊在整格上而不是放進 .video-screen:後者只佔假控制列以上的區域,
          放在裡面會比真正的正中央偏上,跟 MJPEG 等畫面時的轉圈對不齊。 */}
      <div className="video-spin-overlay" role="status" aria-label={emptyText}>
        <span className="video-spinner" />
      </div>
    </div>
  );
}
