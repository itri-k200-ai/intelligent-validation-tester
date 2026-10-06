"use client";
import { Download, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type State = "loading" | "ready" | "missing" | "error";

/**
 * 把一份 PDF 一頁一頁畫成 canvas(pdf.js)。
 *
 * 為什麼不直接用 <iframe src=pdf>:
 *  - 報告 API 回的是 Content-Disposition: attachment,iframe 會變成下載而不是顯示
 *  - Android 的 Chrome 在 iframe 裡根本不顯示 PDF(沒有內建檢視器),手機上會是空白
 * 畫成 canvas 在每個瀏覽器都一樣。另外附「新分頁開啟」與「下載」,
 * 要放大細看或存檔時用瀏覽器自己的 PDF 檢視器。
 *
 * worker 由 build 時從 node_modules 複製到 public/(見 package.json 的 prebuild)——
 * 讓 Next 打包 pdf.worker.min.mjs 會在壓縮階段出錯。用 legacy build:
 * 一般版用到較新的語法,舊一點的 iPhone Safari 會直接掛掉。
 */
export function PdfPages({ url, filename }: { url: string; filename: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<State>("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objUrl: string | null = null;
    let destroy: (() => void) | null = null;
    const box = host.current;
    setState("loading");
    setBlobUrl(null);

    (async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (res.status === 404) return !cancelled && setState("missing");
        const type = res.headers.get("content-type") ?? "";
        if (!res.ok || !type.includes("pdf")) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;
        // blob 網址不受 Content-Disposition 影響,新分頁開啟時會直接顯示
        objUrl = URL.createObjectURL(new Blob([buf], { type: "application/pdf" }));
        setBlobUrl(objUrl);

        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
        destroy = () => void doc.destroy();
        if (cancelled || !box) return;

        box.replaceChildren();
        const width = box.clientWidth || 600;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          if (cancelled) return;
          const scale = (width / page.getViewport({ scale: 1 }).width) * dpr;
          const vp = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(vp.width);
          canvas.height = Math.floor(vp.height);
          canvas.className = "block h-auto w-full rounded-item bg-white shadow-md shadow-black/30";
          canvas.setAttribute("aria-label", `第 ${i} 頁`);
          box.appendChild(canvas);
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
        }
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
      destroy?.();
      box?.replaceChildren();
      if (objUrl) URL.revokeObjectURL(objUrl);
    };
  }, [url]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <a
          href={blobUrl ?? url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white hover:border-mint/60"
        >
          <ExternalLink className="h-3.5 w-3.5" /> 新分頁開啟
        </a>
        <a
          href={url}
          download={filename}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white hover:border-mint/60"
        >
          <Download className="h-3.5 w-3.5" /> 下載 PDF
        </a>
      </div>

      {state !== "ready" && (
        <div className="flex min-h-[240px] items-center justify-center rounded-item border border-dashed border-white/15 text-sm text-white/50">
          {state === "loading" && <span className="video-spinner !h-8 !w-8 !border-[3px]" aria-label="報告載入中" />}
          {state === "missing" && "這一次驗測還沒有報告"}
          {state === "error" && "報告載入失敗,可以改用「新分頁開啟」或「下載 PDF」"}
        </div>
      )}
      <div ref={host} className={state === "ready" ? "flex flex-col gap-3" : "hidden"} />
    </div>
  );
}
