"use client";
import { Maximize2, X } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

/**
 * 小助理回覆的 Markdown(含表格)與 Mermaid 圖。
 *
 * ⚠ 刻意不開 rehype-raw(夾帶 HTML):agent 的回覆是外部來的內容,讓 HTML 原樣進 DOM
 *   等於讓它能塞 <script> / onerror 之類的東西。react-markdown 預設會把 HTML 當純文字,維持這樣。
 *
 * pending(agent 還在逐字吐)時不畫 Mermaid —— 語法還沒完整,畫一半只會一直報錯閃爍。
 */
export function AssistantMarkdown({ text, pending = false }: { text: string; pending?: boolean }) {
  const components: Components = {
    p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="my-1.5 list-disc space-y-0.5 pl-5">{children}</ul>,
    ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-0.5 pl-5">{children}</ol>,
    h1: ({ children }) => <h3 className="mb-1 mt-2 text-base font-semibold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mb-1 mt-2 text-base font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h4 className="mb-1 mt-2 font-semibold first:mt-0">{children}</h4>,
    strong: ({ children }) => <strong className="font-semibold text-mint">{children}</strong>,
    a: ({ href, children }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="text-mint underline underline-offset-2">
        {children}
      </a>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-1.5 border-l-2 border-white/25 pl-3 text-white/75">{children}</blockquote>
    ),
    hr: () => <hr className="my-2 border-white/15" />,
    // 表格在窄的泡泡裡一定放不下,包一層可以左右滑
    table: ({ children }) => (
      <div className="my-2 max-w-full overflow-x-auto rounded-lg border border-white/15">
        <table className="w-max min-w-full border-collapse text-xs">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="whitespace-nowrap border-b border-white/15 bg-white/10 px-2.5 py-1.5 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="whitespace-nowrap border-b border-white/10 px-2.5 py-1.5">{children}</td>,
    // 區塊程式碼由 pre 接手(判斷是不是 mermaid);這裡只剩行內的 `code`
    code: ({ children }) => (
      <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[0.85em]">{children}</code>
    ),
    pre: ({ children }) => {
      const code = codeChild(children);
      if (code?.lang === "mermaid") {
        return pending ? <DiagramPlaceholder text="圖表產生中…" /> : <MermaidDiagram code={code.text} />;
      }
      return (
        <pre className="my-2 max-w-full overflow-x-auto rounded-lg bg-black/40 p-2.5 font-mono text-xs leading-relaxed">
          {code?.text ?? children}
        </pre>
      );
    },
  };

  return (
    <div className="min-w-0 break-words">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** 從 <pre> 底下的 <code className="language-xxx"> 拿出語言與內容 */
function codeChild(children: ReactNode): { lang: string | null; text: string } | null {
  const el = Array.isArray(children) ? children[0] : children;
  if (!el || typeof el !== "object" || !("props" in el)) return null;
  const props = (el as { props: { className?: string; children?: ReactNode } }).props;
  const lang = /language-([\w-]+)/.exec(props.className ?? "")?.[1] ?? null;
  return { lang, text: String(props.children ?? "").replace(/\n$/, "") };
}

function DiagramPlaceholder({ text }: { text: string }) {
  return (
    <div className="my-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-white/50">
      {text}
    </div>
  );
}

// mermaid 套件很大(約 1 MB),第一次真的要畫圖時才載入;之後共用同一份
let mermaidReady: Promise<typeof import("mermaid").default> | null = null;
function loadMermaid() {
  mermaidReady ??= import("mermaid").then(({ default: m }) => {
    m.initialize({
      startOnLoad: false,
      // strict:圖裡的文字一律當純文字、不執行點擊事件 —— 內容來自 agent,同樣不能信任
      securityLevel: "strict",
      // base 主題才吃得到自訂顏色(dark 主題的節點固定是深灰,跟頁面的深藍 / 青色對不起來)
      theme: "base",
      fontFamily: '"Noto Sans TC", system-ui, sans-serif',
      themeVariables: {
        darkMode: true,
        background: "transparent",
        primaryColor: "#16263A",
        primaryTextColor: "#FFFFFF",
        primaryBorderColor: "#72B6C9",
        secondaryColor: "#1C3A4A",
        tertiaryColor: "#0A172F",
        lineColor: "#72B6C9",
        textColor: "#FFFFFF",
        edgeLabelBackground: "#0A172F",
        noteBkgColor: "#1C3A4A",
        noteTextColor: "#FFFFFF",
      },
    });
    return m;
  });
  return mermaidReady;
}

function MermaidDiagram({ code }: { code: string }) {
  const id = "m" + useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    let alive = true;
    setSvg(null);
    setFailed(false);
    loadMermaid()
      .then((m) => m.render(id, code))
      .then(({ svg: out }) => alive && setSvg(out))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [code, id]);

  if (failed) {
    // 語法有誤就把原始內容秀出來,至少看得到它想表達什麼
    return (
      <div className="my-2">
        <div className="mb-1 text-[11px] text-warning">圖表語法有誤,以下是原始內容</div>
        <pre className="max-w-full overflow-x-auto rounded-lg bg-black/40 p-2.5 font-mono text-xs">{code}</pre>
      </div>
    );
  }
  if (!svg) return <DiagramPlaceholder text="繪製圖表中…" />;

  return (
    <>
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label="放大圖表"
        className="group relative my-2 block w-full overflow-hidden rounded-lg border border-white/15 bg-black/20 p-2"
      >
        {/* mermaid 的 securityLevel=strict 已經過濾過,輸出是乾淨的 SVG */}
        <div className="assistant-mermaid [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <span className="absolute right-1.5 top-1.5 rounded-full bg-black/50 p-1 text-white/70 group-hover:text-white">
          <Maximize2 className="h-3.5 w-3.5" />
        </span>
      </button>
      {zoom && (
        <div
          role="dialog"
          aria-label="圖表"
          className="fixed inset-0 z-[60] flex flex-col bg-navy-500/95 backdrop-blur-sm"
          onClick={() => setZoom(false)}
        >
          <div className="flex flex-none justify-end p-3">
            <button type="button" aria-label="關閉" className="rounded-full p-2 text-white/70 hover:bg-white/10 hover:text-white">
              <X className="h-6 w-6" />
            </button>
          </div>
          {/* 手機上可以用兩指縮放、滑動看細節 */}
          <div className="min-h-0 flex-1 overflow-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div
              className="[&_svg]:mx-auto [&_svg]:h-auto [&_svg]:w-full [&_svg]:max-w-none md:[&_svg]:max-w-4xl"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          </div>
        </div>
      )}
    </>
  );
}
