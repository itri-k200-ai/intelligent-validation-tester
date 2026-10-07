"use client";
import { Fragment, useEffect, useState } from "react";

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
  // 文案依 PM 提供;順序是由上往下的層級:SMO → Non-RT RIC → Near-RT RIC → 上面跑的 app
  {
    name: "SMO",
    items: "網路的總管理平台，負責設定、監控與調度整個網路",
    icon: "/images/dut/smo.png",
  },
  {
    name: "Non-RT RIC",
    // \n = PM 原稿指定的換行位置
    items: "負責長期規劃，分析網路歷史資料，\n訂定優化策略",
    icon: "/images/dut/non-rt-ric.png",
  },
  {
    name: "Near-RT RIC",
    items: "負責即時控制，依據策略與當下狀況，\n在毫秒內直接調整基站設定",
    icon: "/images/dut/near-rt-ric.png",
  },
  {
    // xApp 與 rApp 合併一行;圖示用 rApp 那張
    name: "xApp / rApp",
    items: "安裝在 RIC 上的網路優化應用程式，例如干擾抑制、體驗品質提升",
    icon: "/images/dut/rapp.png",
  },
];

/**
 * 測試設備 —— 「用什麼測」,一律寫設備名詞,不要寫測試方法(那是隔壁
 * 「測試方法」那格的事)。不分類,就是一份設備清單。
 * 順序從網路端往使用者端排:基站 → 手機 → AMR → 無人機。
 *
 * icon 同「待測物」:留空顯示待補圖框,圖檔放 public/images/dut/ 後填路徑。
 */
const EQUIPMENT: DutItem[] = [
  {
    name: "基站",
    // 廠商放前面 —— 牆上遠看先辨識是誰的設備,再看型號
    items: "和碩 Pegatron · 室外型 RU_PR2400-79EA",
    icon: "/images/dut/base-station.png",
  },
  {
    // 室內 / 室外都用它當 5G UE(見「測試方法」);廠商放前面,同基站
    name: "手機",
    items: "三星 Samsung · Galaxy S24 —— 5G UE",
    icon: "/images/dut/ue.png",
  },
  {
    // TODO(PM):型號待提供
    name: "AMR",
    items: "自主移動機器人 —— app 實地驗測載具",
    icon: "/images/dut/amr.png",
  },
  {
    name: "無人機",
    items: "app 實地驗測載具",
    icon: "/images/dut/uav.png",
  },
];

/**
 * 測試方法 —— 兩頁:介面測試、效能測試(文案與示意圖依 PM 提供,
 * 圖檔原稿在 docs/外部文件/前端UI建議/,是會自己動的 SVG)。
 *
 * 順序 = 牆上的翻頁順序,第一筆就是開機後先顯示的那頁。
 *
 * figure:示意圖檔放 public/images/dut/ 後填路徑,留空顯示虛線待補框。
 */
const METHODS: { tab: string; lines: string[]; figure?: string }[] = [
  {
    tab: "介面測試",
    lines: [
      "將待測物接入驗測平台的網路架構中，依 3GPP 規格逐項驗證各介面的訊息與回應是否正確，" +
        "自動產出介面一致性驗測報告。",
    ],
    figure: "/images/dut/method-interface.svg",
  },
  {
    tab: "效能測試",
    lines: [
      "將待測物部署至網路架構中，在實體場域比較啟用前後的網路表現，如傳輸速率與訊號品質，" +
        "自動產出效能比較報告。",
    ],
    figure: "/images/dut/method-performance.svg",
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
        <div className="war-room-cat-items">
          {/* 放不下要換行時只在「，」後面換,不要在詞中間斷開
              (實際踩過:「整個網 / 路」「調整基 / 站行為」)。
              段與段之間用 <wbr>:可以換行、但不換行時不會多出空白 */}
          {/* 文字裡的 \n 是指定的換行位置(照原稿),一定換 */}
          {item.items.split("\n").map((line, l) => (
            <Fragment key={l}>
              {l > 0 && <br />}
              {line.split(/(?<=，)/).map((part, i) => (
                <Fragment key={i}>
                  {i > 0 && <wbr />}
                  <span className="whitespace-nowrap">{part}</span>
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
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
      {/* --multiline:每項內文都是兩行,行距放寬(見 globals.css) */}
      <div className="war-room-cat-list war-room-cat-list--fill war-room-cat-list--tight war-room-cat-list--multiline">
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
      {/* 4 項,排法同隔壁「待測物」(也是 4 項),兩格的列高才對得齊 */}
      <div className="war-room-cat-list war-room-cat-list--fill war-room-cat-list--tight">
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

  // 每一頁的示意圖先各抓一次,存成記憶體裡的 blob 網址,換頁就用它。
  //
  // 為什麼不是 new Image() 預載就好:圖檔的快取是 max-age=0,實測每換一個新的 <img>
  // Chrome 都還是會先回伺服器確認一次,網路慢時就「字換了、圖慢半拍」(模擬 2 秒延遲:
  // 每次換頁都等滿 2 秒)。blob 網址不經網路,換頁當下就有圖。
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const made: string[] = [];
    METHODS.forEach(({ figure }) => {
      if (!figure) return;
      fetch(figure)
        .then((r) => (r.ok ? r.blob() : Promise.reject()))
        .then((b) => {
          const url = URL.createObjectURL(b);
          made.push(url);
          if (alive) setBlobs((m) => ({ ...m, [figure]: url }));
        })
        .catch(() => {
          /* 抓不到就用原本的網址(照舊從網路拿) */
        });
    });
    return () => {
      alive = false;
      made.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);
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
          // key 換成圖檔路徑:換頁就換一個新的 <img>,不是只改同一個的 src ——
          // 只改 src 的話,新圖載完之前瀏覽器會一直顯示舊圖(字換了、圖還是上一頁的)。
          // src 用預先抓好的 blob 網址(見上面),新的 <img> 不用等網路;動畫也會從第 ① 步重播
          <img
            key={current.figure}
            className="war-room-method-figure"
            src={blobs[current.figure] ?? current.figure}
            alt=""
          />
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
