"use client";

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
 * 本實驗室受測的待測物,依專案既有的型別分兩組
 * (types/common.ts:PlatformType 與 AppType)。
 *
 * 名稱一律白色 —— 牆上這格是清單,不用各類的代表色去分,顏色統一比較乾淨
 * (參考圖也是只有圖示帶顏色,文字全白)。
 *
 * icon:之後由 PM 提供圖檔。放到 frontend/public/images/dut/ 之後,把下面
 * 對應項目的 icon 填成該檔的路徑(例如 "/images/dut/smo.png")即可;
 * 留空會顯示一個虛線的待補圖框,一眼看得出還缺哪幾張。
 */
type DutItem = { name: string; items: string; icon?: string };

const DUT_GROUPS: { group: string; list: DutItem[] }[] = [
  {
    group: "網路平台",
    list: [
      {
        name: "SMO",
        items: "服務管理與協調(O1 / O2 / A1 / R1)",
      },
      {
        name: "Near-RT RIC",
        items: "E2 / A1 / O1 介面一致性與互通",
      },
      {
        name: "Non-RT RIC",
        items: "A1 Policy / EI、R1(SME / DME / AIML)",
      },
    ],
  },
  {
    group: "智慧應用",
    list: [
      {
        name: "xApp",
        items: "部署於 Near-RT RIC —— 干擾管理、流量導引",
      },
      {
        name: "rApp",
        items: "部署於 Non-RT RIC —— 節能、參數最佳化",
      },
    ],
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
    // TODO(PM):機型待提供
    name: "驗測伺服器",
    items: "機型待補",
  },
  {
    // TODO(PM):機型待提供
    name: "受測伺服器",
    items: "機型待補",
  },
  {
    name: "無人機",
    items: "xApp 實地驗測載具",
  },
  {
    // TODO(PM):型號待提供
    name: "AMR",
    items: "自主移動機器人 —— xApp 實地驗測載具",
  },
  {
    // TODO(PM):型號待提供
    name: "基站",
    items: "型號待補",
  },
];

const CAPABILITY: { iface: string; count: number; desc: string }[] = [
  { iface: "E2", count: 4, desc: "Setup / Subscription / Control / Subscription Delete" },
  { iface: "A1", count: 7, desc: "Policy Type 與 Policy 生命週期" },
  { iface: "O1", count: 4, desc: "NETCONF 登入 / 節點 / 告警 / xApp" },
];

/** 一個項目:圖示 + 名稱 + 一行細節。沒有 icon 就顯示待補圖框。 */
function CatItem({ item }: { item: DutItem }) {
  return (
    <div className="war-room-cat">
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
      <div className="war-room-cat-text">
        <div className="war-room-cat-name">{item.name}</div>
        <div className="war-room-cat-items">{item.items}</div>
      </div>
    </div>
  );
}

/** 分組清單:分組標題 → 該組項目。待測物與測試設備共用。 */
function CatGroups({ groups }: { groups: { group: string; list: DutItem[] }[] }) {
  return (
    <div className="war-room-cat-groups">
      {groups.map((g) => (
        <div key={g.group} className="war-room-cat-group">
          <div className="war-room-cat-group-name">{g.group}</div>
          <div className="war-room-cat-list">
            {g.list.map((c) => (
              <CatItem key={c.name} item={c} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 待測物 —— 本實驗室測哪幾類設備。
 *
 * 版式仿參考圖(通感融合實驗網右牆):分組標題 → 該組項目,每項是
 * 圖示 + 名稱 + 一行細節。
 */
export function RightWingDut() {
  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">待測物</div>
      <CatGroups groups={DUT_GROUPS} />
    </div>
  );
}

/** 測試設備 —— 用什麼去測(不分類,單純一份清單) */
export function RightWingEquip() {
  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">測試設備</div>
      {/* --fill:撐滿卡片剩餘高度並平均分佈,不讓下面空一大塊 */}
      <div className="war-room-cat-list war-room-cat-list--fill">
        {EQUIPMENT.map((e) => (
          <CatItem key={e.name} item={e} />
        ))}
      </div>
    </div>
  );
}

/** 測試方法 —— 各介面測項涵蓋範圍 */
export function RightWingMethod() {
  const total = CAPABILITY.reduce((n, c) => n + c.count, 0);
  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">測試方法</div>
      <div>
        <div className="war-room-slot-label">測項總數</div>
        <div className="war-room-slot-lead">{total}</div>
      </div>
      <div className="war-room-slot-list">
        {CAPABILITY.map((c) => (
          <div key={c.iface} className="war-room-slot-row">
            <div className="war-room-slot-row-head">
              <span className="war-room-slot-iface">{c.iface}</span>
              <span className="war-room-slot-value">{c.count} 項</span>
            </div>
            <div className="war-room-slot-note">{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
