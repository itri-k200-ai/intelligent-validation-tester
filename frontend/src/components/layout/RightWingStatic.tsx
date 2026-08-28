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

const DUT = {
  name: "實驗室 Near-RT RIC",
  kind: "near-rt-ric",
  product: "O-RAN SC Near-RT RIC",
  version: "I-Release",
  status: "active",
  description: "受測實驗室 Near-RT RIC(E2 / A1 / O1)",
  mcc: "455",
  mnc: "637",
  gnbId: "201507",
  cellId: "0",
};

const ENDPOINTS: { iface: string; addr: string; note: string }[] = [
  { iface: "E2", addr: "10.194.87.116:32222", note: "e2term · SCTP" },
  { iface: "A1", addr: "10.194.87.116:32443", note: "a1mediator · HTTPS" },
  { iface: "O1", addr: "10.194.87.116:30830", note: "o1mediator · NETCONF" },
];

const CAPABILITY: { iface: string; count: number; desc: string }[] = [
  { iface: "E2", count: 4, desc: "Setup / Subscription / Control / Subscription Delete" },
  { iface: "A1", count: 7, desc: "Policy Type 與 Policy 生命週期" },
  { iface: "O1", count: 4, desc: "NETCONF 登入 / 節點 / 告警 / xApp" },
];

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="war-room-slot-label">{label}</div>
      <div className="war-room-slot-value">{value}</div>
    </div>
  );
}

/** 待測物 —— 受測設備身分 */
export function RightWingDut() {
  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">待測物</div>
      <div className="war-room-slot-lead">{DUT.name}</div>
      <div className="war-room-slot-grid">
        <Field label="類型" value={DUT.kind} />
        <Field label="狀態" value={DUT.status} />
        <Field label="產品" value={DUT.product} />
        <Field label="版本" value={DUT.version} />
      </div>
      <div>
        <div className="war-room-slot-label">描述</div>
        <div className="war-room-slot-value">{DUT.description}</div>
      </div>
      <div>
        <div className="war-room-slot-label">E2 身分(gNB)</div>
        <div className="war-room-slot-mono">
          MCC {DUT.mcc} / MNC {DUT.mnc} / gNB {DUT.gnbId} / Cell {DUT.cellId}
        </div>
      </div>
    </div>
  );
}

/** 測試設備 —— 各介面連線端點 */
export function RightWingEquip() {
  return (
    <div className="war-room-slot">
      <div className="war-room-slot-title">測試設備</div>
      <div className="war-room-slot-list">
        {ENDPOINTS.map((e) => (
          <div key={e.iface} className="war-room-slot-row">
            <div className="war-room-slot-row-head">
              <span className="war-room-slot-iface">{e.iface}</span>
              <span className="war-room-slot-mono">{e.addr}</span>
            </div>
            <div className="war-room-slot-note">{e.note}</div>
          </div>
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
