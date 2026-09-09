"use client";
import { useState } from "react";

/**
 * 右副牆下半部三格的「靜態」內容:待測物 / 測試設備 / 測試方法。
 *
 * 右副牆不再跟左螢幕溝通、也不隨選中的 DUT 變動 —— 它就是一面固定的說明牆。
 * 目前這份文案以 Near-RT RIC 的實際登錄資料為底稿(取自 RICtester
 * registry/duts + dut_endpoints),之後由 PM 提供正式文案再替換 —— 改下面
 * 三個常數即可,不牽動任何資料流。
 *
 * 排版一律走 globals.css 的 .war-room-slot-* class,不要用 Tailwind 的
 * text-sm / text-xs:牆版面沒有對這裡的子元素做字級縮放,14px 在 11520px
 * 的畫布上等於看不見。級距對齊參考圖(標題 → 細線 → 內文)。
 */

/**
 * 本實驗室受測的待測物 —— 不分組,直接列五類。
 *
 * 名稱一律白色 —— 牆上這格是清單,不用各類的代表色去分,顏色統一比較乾淨
 * (參考圖也是只有圖示帶顏色,文字全白)。
 *
 * icon:圖檔在 frontend/public/images/dut/,由 PM 提供的整張圖切出來的
 * (去背成透明,neon 線稿疊在卡片漸層上才不會出現黑塊)。
 * 留空會顯示虛線的待補圖框。
 */
type DutItem = { name: string; items: string; icon?: string };

const DUT_LIST: DutItem[] = [
  {
    name: "SMO",
    items: "服務管理與協調(O1 / O2 / A1 / R1)",
    icon: "/images/dut/smo.png",
  },
  {
    name: "Near-RT RIC",
    items: "E2 / A1 / O1 介面一致性與互通",
    icon: "/images/dut/near-rt-ric.png",
  },
  {
    name: "Non-RT RIC",
    items: "A1 Policy / EI、R1(SME / DME / AIML)",
    icon: "/images/dut/non-rt-ric.png",
  },
  {
    // xApp 與 rApp 的測試內容相同,合併一行;圖示用 rApp 那張
    name: "xApp / rApp",
    items: "效能測試",
    icon: "/images/dut/rapp.png",
  },
];

/**
 * 測試設備 —— 「用什麼測」,一律寫設備名詞,不要寫測試方法(那是隔壁
 * 「測試方法」那格的事)。不分類,就是一份設備清單。
 *
 * icon 同「待測物」:留空顯示待補圖框,圖檔放 public/images/dut/ 後填路徑。
 */
const EQUIPMENT: DutItem[] = [
  {
    name: "無人機",
    items: "xApp 實地驗測載具",
    icon: "/images/dut/uav.png",
  },
  {
    // TODO(PM):型號待提供
    name: "AMR",
    items: "自主移動機器人 —— xApp 實地驗測載具",
    icon: "/images/dut/amr.png",
  },
  {
    name: "基站",
    // 廠商放前面 —— 牆上遠看先辨識是誰的設備,再看型號
    items: "和碩 Pegatron · 室外型 RU_PR2400-79EA",
    icon: "/images/dut/base-station.png",
  },
];

/**
 * 測試方法 —— 各待測物的測試方法不同,所以分頁呈現。
 *
 * 分頁鍵沿用「待測物」那格的分類名稱,兩格對照得起來。
 * 內容由 PM 提供,填 lines 即可;留空會顯示待補提示。
 */
/**
 * 測試方法 —— 三頁。
 *
 * SMO / Near-RT RIC / Non-RT RIC 的測試方法相近,合併成「介面測試」一頁;
 * xApp / rApp 依場域拆成室內、室外兩頁。
 *
 * figure:示意圖檔放 public/images/dut/ 後填路徑,留空顯示虛線待補框。
 */
const METHODS: { tab: string; lines: string[]; figure?: string }[] = [
  {
    tab: "介面測試",
    lines: [
      "依 O-RAN / 3GPP 規格逐項驗證各介面的程序與回應",
      "SMO — O1 / O2 / A1 / R1",
      "Near-RT RIC — E2 / A1 / O1",
      "Non-RT RIC — A1 Policy / EI、R1(SME / DME / AIML)",
    ],
  },
  {
    tab: "室內測試",
    lines: [
      "於工研院 51 館 5 樓建立室內干擾情境,配置手機與 AMR 作為 5G UE。" +
        "比較 IM xApp 啟用前後的網路表現,驗證干擾抑制效果。",
    ],
  },
  {
    tab: "戶外測試",
    lines: [
      "於工研院 52 館外大草坪配置手機與無人機進行實測。" +
        "透過無人機穿越干擾與非干擾區,驗證 QoE xApp 的改善效果。",
    ],
  },
];

/** 一個項目:圖示 + 名稱 + 一行細節。沒有 icon 就顯示待補圖框。 */
function CatItem({ item }: { item: DutItem }) {
  return (
    <div className="war-room-cat">
      {/* 版式仿參考圖:標題自己一行,底下才是 icon + 內容並排 */}
      <div className="war-room-cat-name">{item.name}</div>
      <div className="war-room-cat-row">
        {item.icon ? (
          <img className="war-room-cat-icon" src={item.icon} alt="" />
        ) : (
          /* 待補圖 —— 有了圖檔就把上面陣列裡的 icon 填上 */
          <span
            className="war-room-cat-icon war-room-cat-icon--todo"
            title={`待補 ${item.name} 圖示`}
          >
            圖
          </span>
        )}
        <div className="war-room-cat-items">{item.items}</div>
      </div>
    </div>
  );
}

/**
 * 待測物 —— 本實驗室測哪幾類設備。
 *
 * 版式仿參考圖(通感融合實驗網右牆):每項是標題一行,底下 icon + 細節。
 */
export function RightWingDut() {
  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">待測物</div>
      {/* --tight:5 項要收緊間距,否則最後一項會被卡片裁到 */}
      <div className="war-room-cat-list war-room-cat-list--fill war-room-cat-list--tight">
        {DUT_LIST.map((d) => (
          <CatItem key={d.name} item={d} />
        ))}
      </div>
    </div>
  );
}

/** 測試設備 —— 用什麼去測(不分類,單純一份清單) */
export function RightWingEquip() {
  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">測試設備</div>
      {/* --lg:只有 3 項,icon 放大讓版面不空 */}
      <div className="war-room-cat-list war-room-cat-list--fill war-room-cat-list--lg">
        {EQUIPMENT.map((e) => (
          <CatItem key={e.name} item={e} />
        ))}
      </div>
    </div>
  );
}

/**
 * 測試方法 —— 依待測物分頁,用左右箭頭翻頁。
 *
 * 版式對齊參考圖(通感融合實驗網右牆的測試方法格):
 *   名稱一行 → 說明文字(較亮,拉出層次)→ 示意圖(左右箭頭夾著)→ 頁碼點
 * 參考圖那格大半是示意圖,所以這裡也留了圖位;圖檔未到前顯示虛線框。
 *
 * 牆面若沒有輸入裝置,箭頭與頁碼點都點不到 —— 屆時改成定時輪播即可
 * (setPage 加 setInterval),版面不用動。
 */
export function RightWingMethod() {
  const [page, setPage] = useState(0);
  const total = METHODS.length;
  const current = METHODS[page];
  const go = (d: number) => setPage((p) => (p + d + total) % total);

  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">測試方法</div>

      <div className="war-room-method-name">{current.tab}</div>

      <div className="war-room-method-desc">
        {current.lines.length ? (
          current.lines.map((l) => <div key={l}>{l}</div>)
        ) : (
          <div className="war-room-method-todo">（測試方法待補）</div>
        )}
      </div>

      <div className="war-room-pager">
        <button
          type="button"
          className="war-room-pager-arrow"
          onClick={() => go(-1)}
          aria-label="上一頁"
        >
          ‹
        </button>
        {current.figure ? (
          <img className="war-room-method-figure" src={current.figure} alt="" />
        ) : (
          /* 示意圖待補 —— 圖檔放 public/images/dut/ 後把 figure 填成路徑 */
          <div className="war-room-method-figure war-room-method-figure--todo">
            示意圖待補
          </div>
        )}
        <button
          type="button"
          className="war-room-pager-arrow"
          onClick={() => go(1)}
          aria-label="下一頁"
        >
          ›
        </button>
      </div>

      <div className="war-room-pager-dots">
        {METHODS.map((m, i) => (
          <button
            key={m.tab}
            type="button"
            aria-label={m.tab}
            onClick={() => setPage(i)}
            className={`war-room-pager-dot ${i === page ? "is-current" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
