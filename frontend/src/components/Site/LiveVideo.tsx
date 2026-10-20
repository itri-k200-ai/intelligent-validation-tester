"use client";
import { useEffect, useState, type ReactNode } from "react";
import { Maximize2, Pause, Play, Volume2 } from "lucide-react";

import { FieldHlsVideo } from "./FieldHlsVideo";
import { cameraStreamOrigin, onCameraOriginChange } from "@/lib/fieldCameras";
import { readMjpeg, type Frame } from "@/lib/mjpegStream";

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
 * MJPEG 一格:後端代理的 multipart 串流,自己用 fetch 讀(lib/mjpegStream)、一張張換進 <img>。
 * 元件卸載就 abort —— 上游同時只允許 3 路,不看要真的斷線。
 *
 * 不再直接 <img src=串流>:Chrome 的 <img> 遇到串流結束 / 卡住 / 一張都沒來就斷,
 * 完全不會觸發事件,那一格就永遠停住、不會重連(「有時候即時影像都不出現」就是這個)。
 * 現在只要 STALL_MS 沒來新的一張、串流結束或出錯,就斷掉重連;間隔從 1 秒起跳、
 * 每次加倍、最多 RETRY_MAX_MS,一收到畫面就歸零。
 */
const STALL_MS = 10_000;
const RETRY_MAX_MS = 15_000;

/** 右上角那顆標籤要標「LIVE」還是「回放」—— 回放時那幾格在轉圈,標 LIVE 會騙人 */
export type VideoBadge = "live" | "replay";

function Badge({ kind }: { kind: VideoBadge }) {
  if (kind === "replay") return <span className="field-replay-badge">回放</span>;
  return (
    <div className="video-live-badge">
      <span className="video-live-dot" /> LIVE
    </div>
  );
}

/** 讀 MJPEG 串流,回傳目前這一張的 blob 網址(還沒有畫面就是 null)。斷了自己重連。 */
function useMjpegFrame(url: string | null) {
  const [frame, setFrame] = useState<string | null>(null);
  useEffect(() => {
    setFrame(null);
    if (!url) return;
    let alive = true;
    let ctrl: AbortController | null = null;
    let retryTimer = 0;
    let stallTimer = 0;
    let delay = 1000;
    // 最近兩張的網址:畫面上那張 + 正要換上去的那張
    const shown: string[] = [];

    const show = (jpg: Frame) => {
      const next = URL.createObjectURL(new Blob([jpg], { type: "image/jpeg" }));
      // 換下來的就放掉,不然 5 fps 掛一整天記憶體會一直漲。留兩張:<img> 可能還沒換上新的那張,
      // 這時把它正顯示的那張收掉會閃一下破圖
      shown.push(next);
      while (shown.length > 2) URL.revokeObjectURL(shown.shift()!);
      setFrame(next);
    };
    const armStall = () => {
      window.clearTimeout(stallTimer);
      stallTimer = window.setTimeout(() => ctrl?.abort(), STALL_MS);
    };
    const connect = () => {
      ctrl = new AbortController();
      armStall();
      readMjpeg(url, ctrl.signal, (jpg) => {
        delay = 1000;
        armStall();
        show(jpg);
      })
        .catch(() => undefined)
        .finally(() => {
          window.clearTimeout(stallTimer);
          if (!alive) return;
          ctrl?.abort();
          retryTimer = window.setTimeout(connect, delay);
          delay = Math.min(delay * 2, RETRY_MAX_MS);
        });
    };
    connect();
    return () => {
      alive = false;
      window.clearTimeout(retryTimer);
      window.clearTimeout(stallTimer);
      ctrl?.abort();
      shown.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [url]);
  return frame;
}

/** 串流要走的網址:相對路徑換到攝影機專用埠(探到之前是 null,先不開串流) */
function useCameraUrl(src: string) {
  // 串流走攝影機專用埠(連得到才換,見 lib/fieldCameras 的 cameraStreamOrigin)。
  // 探到之前先不開串流,不然會先在 38080 上連一次、再換埠重連
  const [origin, setOrigin] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    cameraStreamOrigin().then((o) => alive && setOrigin(o));
    // 先用同源開了、背景才探到更好的埠(或記住的那個不通了):換過去,串流會自己重連
    const off = onCameraOriginChange((o) => alive && setOrigin(o));
    return () => {
      alive = false;
      off();
    };
  }, []);
  return origin === null ? null : src.startsWith("/") ? `${origin}${src}` : src;
}

/**
 * 給牆面以外的頁面(/field)用的 MJPEG 一格:播法跟牆上一樣(自己讀串流、斷了重連),
 * 只是轉圈與標籤的樣子由外面給(牆面的樣式是照 11520 寬的畫布放大的)。
 */
export function FieldMjpegVideo({
  src,
  alt,
  badge,
  spinner,
}: {
  src: string;
  alt: string;
  badge: ReactNode;
  spinner: ReactNode;
}) {
  const frame = useMjpegFrame(useCameraUrl(src));
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {frame ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="h-full w-full object-cover" src={frame} alt={alt} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="等待影像">
          {spinner}
        </div>
      )}
      {badge}
    </div>
  );
}

function MjpegVideo({
  src,
  emptyText,
  badge,
}: {
  src: string;
  emptyText: string;
  badge: VideoBadge;
}) {
  const frame = useMjpegFrame(useCameraUrl(src));

  // 還沒有畫面(探埠中、連線中、重連中):轉圈。驅動之後載具還要走到起點,
  // 這段空白不標示會看起來像壞了
  if (!frame) return <LiveVideo src={null} emptyText={emptyText} badge={badge} />;
  return (
    <div className="relative h-full w-full overflow-hidden">
      <img className="h-full w-full object-cover" src={frame} alt="即時影像" />
      <Badge kind={badge} />
    </div>
  );
}

export function LiveVideo({
  src,
  emptyText = "尚無攝影機串流",
  badge = "live",
}: {
  src?: string | null;
  emptyText?: string;
  badge?: VideoBadge;
}) {
  // 車載影像是 MJPEG(外部平台 B6,經後端 /api/field-tests/camera/… 代理):
  // 直接用 <img> 吃 multipart 串流,不進 hls.js。元件卸載瀏覽器就會斷線 ——
  // 上游同時只允許 3 路,不看要真的移除元素。
  if (src && isMjpeg(src)) return <MjpegVideo src={src} emptyText={emptyText} badge={badge} />;
  // 場域攝影機的 HLS:展示用(不顯示控制列、填滿整格、轉圈與標籤跟其他格一致)。
  // 只認 /hls/field-* —— DUT 牆等其他地方的 HLS 維持原本的 HlsPlayer,不跟著改
  if (src && src.startsWith("/hls/field-"))
    return (
      <FieldHlsVideo
        src={src}
        badge={<Badge kind={badge} />}
        spinner={<span className="video-spinner" />}
        messageClassName="field-hls-message"
      />
    );
  if (src) return <HlsPlayer src={src} />;
  return (
    <div className="video-placeholder">
      <div className="video-screen">
        <Badge kind={badge} />
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
