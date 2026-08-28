/**
 * Maps the current pathname to {title, subtitle, accent} shown in the
 * top Header bar. Centralised so adding/renaming a route doesn't require
 * editing every page.
 *
 * `accent` provides the DUT-type colour link that the now-removed
 * DutTypeBanner used to provide — applied to the title text in Header.
 */

const DUT_TYPE_LABEL: Record<string, string> = {
  smo: "SMO",
  ric: "Near-RT RIC", // 既有 /ric URL 視為 Near-RT RIC
  "near-rt-ric": "Near-RT RIC",
  "non-rt-ric": "Non-RT RIC",
  xapp: "xApp",
  rapp: "rApp",
};

const REGION_LABEL: Record<string, string> = {
  domestic: "國內場域",
  international: "國外場域",
};

// Tailwind class fragments — `text-mint-300` etc. — applied to the title.
const DUT_TYPE_ACCENT: Record<string, string> = {
  smo: "text-mint-300",
  ric: "text-teal",
  "near-rt-ric": "text-teal",
  "non-rt-ric": "text-teal",
  xapp: "text-warning",
  rapp: "text-danger",
};

export type PageMeta = { title: string; subtitle?: string; accent?: string };

export function getPageMeta(pathname: string): PageMeta {
  const seg = pathname.split("/").filter(Boolean);

  if (seg[0] === "overview") {
    return { title: "驗證總覽" };
  }

  if (seg[0] === "interface-validation" && seg[1]) {
    const t = DUT_TYPE_LABEL[seg[1]] ?? seg[1].toUpperCase();
    return {
      title: `連接介面驗證 - ${t}`,
      subtitle: `檢查所有 ${t} 設備的接口介面是否正常運作`,
      accent: DUT_TYPE_ACCENT[seg[1]],
    };
  }

  if (seg[0] === "data-validation" && seg[1]) {
    const t = DUT_TYPE_LABEL[seg[1]] ?? seg[1].toUpperCase();
    return {
      title: `資料品質驗證 - ${t}`,
      subtitle: `針對已註冊的 ${t} 設備執行資料完整性、準確性與即時性驗證`,
      accent: DUT_TYPE_ACCENT[seg[1]],
    };
  }

  if (seg[0] === "intelligence-validation" && seg[1]) {
    const t = DUT_TYPE_LABEL[seg[1]] ?? seg[1].toUpperCase();
    return {
      title: `智慧程度驗證 - ${t}`,
      accent: DUT_TYPE_ACCENT[seg[1]],
    };
  }

  if (seg[0] === "test-scenarios") {
    if (seg[1]) return { title: "情境詳情" };
    return {
      title: "端對端測試情境",
      subtitle: "管理各場域收上來的資料情境",
    };
  }

  if (seg[0] === "documents") {
    return {
      title: "規格文件",
      subtitle: "驗測案例引用來源（IETF / 3GPP / ITU-T / O-RAN）",
    };
  }

  if (seg[0] === "agent-sessions") {
    if (seg[1]) return { title: "驗測回朔" };
    return {
      title: "Agent 驗測紀錄",
      subtitle: "Near-RT RIC Validation Agent 跑過的所有 session + 完整 audit trail",
    };
  }

  if (seg[0] === "site-management" && seg[1]) {
    return { title: REGION_LABEL[seg[1]] ?? "場域管理" };
  }

  // 中牆的固定 URL —— 顯示什麼由 selection 決定,標題不隨內容變。
  // (右副牆自己的標題是「智慧網路實驗室簡介」,見 war-room-lab-title。)
  if (seg[0] === "wall") {
    return { title: "智慧網路實驗室" };
  }

  return { title: "" };
}
