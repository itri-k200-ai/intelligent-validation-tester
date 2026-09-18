// ── RICtester 來源(可同時接多套獨立部署的 tester)────────────────
//
// 10.194.87.120 上跑著數套彼此獨立的 RICtester(各自一組 front-end /
// back-end / adapter / DB),依受測物種類分開:
//
//   NearRICTester  back_end :5000  adapter :5100  → Lab Near-RT RIC(E2/A1/O1)
//   NonRICTester   back_end :5010  adapter :5110  → Lab Non-RT RIC(A1/EI/SME/R1/DME/AIML)
//   (xApp tester   back_end :5020  adapter :5120  → 目前不接)
//
// IVT nginx 把每一套代理到自己的路徑前綴,前端同時抓取後合併顯示。
// 要新增/移除一套:改這裡 + deploy/nginx.conf.template + deploy/.env,
// 其餘程式不用動。
export type RicSourceId = "near" | "non" | "im";

export type RicSource = {
  id: RicSourceId;
  /** 牆上顯示的來源名稱(左牆分組標題)。 */
  label: string;
  /** 經 IVT nginx 的路徑前綴;adapter 走 {base}/autoTest/*、back_end 走 {base}/api/back_end/*。 */
  base: string;
  /**
   * 中牆是否要吃這套的資料(adapter 測試清單 + back_end 的執行狀態/型錄)。
   * false = 只出現在左螢幕的 API 工具,牆面完全不碰 —— 用在「只想手動打打看」
   * 的 tester 上,免得中牆每 5 秒去輪詢一套它其實不顯示的來源。
   */
  onWall: boolean;
  /**
   * 這套有沒有 back_end(/api/back_end/*)。imctrl 只有 adapter,沒有 back_end ——
   * 不標出來的話,useRicActiveRun / useRicTestcaseCatalog 會一直打到 404。
   */
  backend: boolean;
};

export const RIC_SOURCES: RicSource[] = [
  { id: "near", label: "Near-RT RIC", base: "/ric/near", onWall: true, backend: true },
  { id: "non", label: "Non-RT RIC", base: "/ric/non", onWall: true, backend: true },
  // imctrl —— 10.194.87.115:8012。只有 adapter、沒有 back_end,目前只給左螢幕
  // 的 API 工具手動打,牆面不吃它的資料(onWall: false)。
  { id: "im", label: "IM 控制器", base: "/ric/im", onWall: false, backend: false },
];

/** 中牆要吃資料的來源(adapter 測試清單、執行狀態…)。 */
export const WALL_RIC_SOURCES = RIC_SOURCES.filter((s) => s.onWall);
/** 有 back_end 可讀的來源(執行狀態、測項型錄、判決…)。 */
export const BACKEND_RIC_SOURCES = RIC_SOURCES.filter((s) => s.onWall && s.backend);

export const DEFAULT_RIC_SOURCE: RicSourceId = "near";

export function ricSourceBase(id: RicSourceId | null | undefined): string {
  return RIC_SOURCES.find((s) => s.id === id)?.base ?? RIC_SOURCES[0].base;
}

export function ricSourceLabel(id: RicSourceId | null | undefined): string {
  return RIC_SOURCES.find((s) => s.id === id)?.label ?? "";
}
