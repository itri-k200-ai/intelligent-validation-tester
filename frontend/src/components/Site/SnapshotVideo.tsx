"use client";
import { useEffect, useState } from "react";

/** 正常時多久抓一張(毫秒) */
const SNAPSHOT_MS = 2000;
/** 抓不到之後隔多久再試(設備修好要能自己復原) */
const RETRY_MS = 10_000;

/**
 * 一格「準即時」影像:定時抓單張快照,不開 MJPEG 串流。
 *
 * 給一般 / 手機版用 —— 理由見 lib/fieldCameras 的 snapshotSources(串流會搶走牆上的
 * 名額、也會佔住瀏覽器的連線)。
 *
 * 用 fetch → blob → objectURL,而不是直接換 <img src>:換 src 時舊圖會先消失、
 * 新圖還沒到,畫面會閃;而且先用 Image() 預載再換 src 會抓兩次(快照不快取)。
 * 分頁看不到時暫停,省流量。
 */
export function SnapshotVideo({
  src,
  badge = "live",
  alt,
}: {
  src: string | null;
  /** 右上角標「LIVE」還是「回放」 */
  badge?: "live" | "replay";
  alt: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
    if (!src) return;
    let alive = true;
    let timer: number | undefined;
    let ctrl: AbortController | null = null;
    let current: string | null = null;

    const next = (ms: number) => {
      if (alive) timer = window.setTimeout(load, ms);
    };
    async function load() {
      if (document.visibilityState === "hidden") return next(SNAPSHOT_MS);
      ctrl = new AbortController();
      try {
        const res = await fetch(src!, { signal: ctrl.signal, cache: "no-store" });
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.startsWith("image/")) throw new Error(String(res.status));
        const obj = URL.createObjectURL(await res.blob());
        if (!alive) return URL.revokeObjectURL(obj);
        if (current) URL.revokeObjectURL(current);
        current = obj;
        setUrl(obj);
        next(SNAPSHOT_MS);
      } catch {
        // 抓不到就回到轉圈(不要一直停在很久以前的那張,會被當成即時)
        if (!alive) return;
        if (current) URL.revokeObjectURL(current);
        current = null;
        setUrl(null);
        next(RETRY_MS);
      }
    }
    load();
    return () => {
      alive = false;
      window.clearTimeout(timer);
      ctrl?.abort();
      if (current) URL.revokeObjectURL(current);
    };
  }, [src]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="h-full w-full object-cover" src={url} alt={alt} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center" role="status" aria-label="等待影像">
          <span className="video-spinner !h-8 !w-8 !border-[3px]" />
        </div>
      )}
      <VideoBadge kind={badge} />
    </div>
  );
}

export function VideoBadge({ kind }: { kind: "live" | "replay" }) {
  return kind === "replay" ? (
    <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-warning">
      回放
    </span>
  ) : (
    <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-danger/85 px-2 py-0.5 text-[11px] font-bold tracking-wider text-white">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      LIVE
    </span>
  );
}
