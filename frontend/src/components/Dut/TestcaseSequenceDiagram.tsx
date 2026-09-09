"use client";

import { resolveTestcaseIo, testcaseIoAccent } from "@/lib/testcaseIo";

// ── 測試案例時序圖 ──────────────────────────────────────────────────
// 移植自 RICtester 測試案例頁的「輸入 / 輸出」區塊,版面與座標沿用它的
// 手刻 SVG(viewBox 720×196、Tester x=120、DUT x=600)。兩處差異:配色改
// 成深色牆面版(原版白底綠字,放到牆上會整塊發亮),以及不畫「通過條件」
// —— 那一列在左邊的測試項目清單每一列都已經有了,重複顯示只是佔空間。
//
// 資料來源全部是 RICtester registry/testcases 已有的欄位:
//   procedure     → 箭頭上的訊息名(「… Request」/「… Response」)
//   interfaceName → 配色與 fallback 的協定字首
//   請求 / 回應的細項由 resolveTestcaseIo() 查對照表得到(見 lib/testcaseIo)。

const W = 720;
const H = 196;
const TESTER_X = 120;
const DUT_X = 600;

export function TestcaseSequenceDiagram({
  procedure,
  interfaceName,
}: {
  procedure: string;
  interfaceName?: string | null;
}) {
  const proc = procedure || "Procedure";
  const accent = testcaseIoAccent(interfaceName);
  const io = resolveTestcaseIo(proc, interfaceName);

  return (
    <div className="flex h-full min-h-0 w-full flex-col gap-2">
      {/* 時序圖本體 */}
      <div className="flex-none">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`${proc} 測試案例輸入輸出時序圖`}
          className="block h-auto w-full"
        >
          <defs>
            <marker
              id="seq-arrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} />
            </marker>
          </defs>

          <Actor x={TESTER_X} label="測試端" sub="Tester" accent={accent} />
          <Actor x={DUT_X} label="受測設備" sub="DUT" accent={accent} />

          {/* 請求(實線,測試端 → 受測設備)*/}
          <text x={W / 2} y={89} textAnchor="middle" className="seq-msg">
            {proc} Request
          </text>
          <line
            x1={TESTER_X}
            y1={98}
            x2={DUT_X}
            y2={98}
            stroke={accent}
            strokeWidth={1.8}
            markerEnd="url(#seq-arrow)"
          />
          <text x={TESTER_X + 6} y={112} className="seq-note">
            輸入 送出 →
          </text>

          {/* 回應(虛線,受測設備 → 測試端)*/}
          <text x={W / 2} y={145} textAnchor="middle" className="seq-msg">
            {proc} Response
          </text>
          <line
            x1={DUT_X}
            y1={154}
            x2={TESTER_X}
            y2={154}
            stroke={accent}
            strokeWidth={1.8}
            strokeDasharray="7 5"
            markerEnd="url(#seq-arrow)"
          />
          <text x={DUT_X - 6} y={168} textAnchor="end" className="seq-note">
            ← 收到回應
          </text>
        </svg>
      </div>

      {/* 輸入 / 輸出兩欄 */}
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <IoBox title="▶ 輸入 / 送出" caption={`${proc} Request`} lines={io.request} accent={accent} />
        <IoBox
          title="◀ 輸出 / 預期回應"
          caption={`${proc} Response`}
          lines={io.response}
          accent={accent}
        />
      </div>
    </div>
  );
}

// 生命線上的角色方塊(測試端 / 受測設備)
function Actor({
  x,
  label,
  sub,
  accent,
}: {
  x: number;
  label: string;
  sub: string;
  accent: string;
}) {
  return (
    <g>
      <rect
        x={x - 70}
        y={18}
        width={140}
        height={34}
        rx={8}
        fill="rgba(255,255,255,0.06)"
        stroke={accent}
        strokeWidth={1.4}
      />
      <text x={x} y={33} textAnchor="middle" className="seq-actor">
        {label}
      </text>
      <text x={x} y={45} textAnchor="middle" className="seq-actor-sub">
        {sub}
      </text>
      {/* 生命線 */}
      <line
        x1={x}
        y1={52}
        x2={x}
        y2={180}
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
        strokeDasharray="3 3"
      />
    </g>
  );
}

// 請求 / 回應細項框
function IoBox({
  title,
  caption,
  lines,
  accent,
}: {
  title: string;
  caption: string;
  lines: string[];
  accent: string;
}) {
  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-item border border-white/10 bg-white/[0.03] px-3 py-2">
      <div className="flex-none text-xs" style={{ color: accent }}>
        {title}
      </div>
      <div className="flex-none truncate font-mono text-xs text-white/45">{caption}</div>
      <ul className="mt-1 min-h-0 flex-1 space-y-0.5 overflow-hidden border-t border-dashed border-white/10 pt-1">
        {lines.map((line) => (
          <li key={line} className="truncate font-mono text-sm text-white/80">
            · {line}
          </li>
        ))}
      </ul>
    </div>
  );
}
