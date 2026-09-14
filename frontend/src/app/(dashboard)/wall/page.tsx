"use client";
import { DutManagementContainer } from "@/components/Dut/DutManagementContainer";
import { OutdoorScenarioContainer } from "@/components/Outdoor/OutdoorScenarioContainer";
import { OverviewContainer } from "@/components/Overview/OverviewContainer";
import { RunRecordsContainer } from "@/components/Records/RunRecordsContainer";
import { SiteManagementContainer } from "@/components/Site/SiteManagementContainer";
import { useRicActiveRun } from "@/hooks/Backend/useRicActiveRun";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";
import type { DutType, Region } from "@/types/common";

/**
 * 中牆的唯一 URL。
 *
 * 中牆固定停在 /wall 不再導航。顯示什麼有兩個來源,**有測試在跑的優先**:
 *
 *   1. RICtester back_end 偵測到有執行在跑(useRicActiveRun)→ 直接畫測試
 *      畫面,不看 selection。中牆因此與左螢幕完全脫鉤:別的團隊自己打
 *      tester 的 API 驅動測試,牆一樣會跳過去,不需要有人先在左螢幕選過
 *      東西。跑完會多跟一段時間(見 useRicActiveRun)才放手。
 *   2. 沒有執行在跑 → 照 selection 顯示(別團隊的左 app 打
 *      POST /api/selection/current/ 指定),預設是總覽。
 *
 * 例外:室外 UAV 情境(/outdoor-scenario)見 WallPage 內的說明。
 *
 * selection.href 保留原本的路徑字串,但語意已經是「內容識別碼」而不是
 * 導覽目標;沿用它是為了讓左螢幕的選單定義不用改。原本那些路由
 * (/overview、/interface-validation/[dutType] …)仍然存在,非牆模式的
 * 側邊選單照常可以單獨開,兩邊共用同一批 container。
 */

const DUT_TYPE: Record<string, DutType> = {
  smo: "SMO",
  ric: "Near-RT RIC",
  "near-rt-ric": "Near-RT RIC",
  "non-rt-ric": "Non-RT RIC",
  xapp: "xApp",
  rapp: "rApp",
};

const REGION: Record<string, Region> = {
  domestic: "domestic",
  international: "international",
};

/** 室外 UAV 情境的內容識別碼 */
const OUTDOOR_PATH = "/outdoor-scenario";

/** selection.href → 正規化的內容識別碼(去 query、去尾斜線,空的當總覽) */
function contentPath(href: string | undefined) {
  return (href ?? "/overview").split("?")[0].replace(/\/+$/, "") || "/overview";
}

function render(path: string) {
  if (path === "/test-records") return <RunRecordsContainer />;
  if (path === OUTDOOR_PATH) return <OutdoorScenarioContainer />;

  const iface = path.match(/^\/interface-validation\/([^/]+)$/);
  if (iface) {
    const t = DUT_TYPE[iface[1].toLowerCase()];
    if (t) return <DutManagementContainer dutType={t} />;
  }

  const site = path.match(/^\/site-management\/([^/]+)$/);
  if (site) {
    const r = REGION[site[1].toLowerCase()];
    if (r) return <SiteManagementContainer region={r} />;
  }

  // 認不得的內容識別碼一律退回總覽 —— 牆上寧可顯示總覽,也不要空白。
  return <OverviewContainer />;
}

/** 執行中的那套 tester 對應到哪一種 DUT —— 決定要渲染哪個介面驗證頁。 */
const SOURCE_DUT_TYPE: Record<string, DutType> = {
  near: "Near-RT RIC",
  non: "Non-RT RIC",
};

const ms = (iso: string | undefined) => {
  const t = Date.parse(iso ?? "");
  return Number.isNaN(t) ? 0 : t;
};

export default function WallPage() {
  const selection = useWallSelectionStore((s) => s.selection);
  const { activeRun } = useRicActiveRun();
  const path = contentPath(selection?.href);

  // 室外 UAV 情境例外:useRicActiveRun 跑完也不放手,只要 RIC 有過任何一筆
  // 執行,activeRun 就一直有值 —— 室外 tester 還沒串、沒有自己的執行狀態,
  // 照原規則會永遠切不過去。所以 RIC 沒在跑、且左螢幕是在那次執行結束
  // **之後**才選室外,就讓給室外(執行中途選的不算,跑完仍停在判決)。
  // 室外串接後有了執行狀態,再改成跟 RIC 一樣「有在跑的優先」。
  const outdoorPicked =
    path === OUTDOOR_PATH &&
    !!activeRun &&
    !activeRun.live &&
    ms(selection?.updatedAt) > ms(activeRun.finishedAt || activeRun.startedAt);

  // 有測試在跑就直接顯示測試畫面 —— selection 沒被設過(新機、Redis 重
  // 啟後)也一樣,不會停在總覽把執行中的測試漏掉。
  if (activeRun && !outdoorPicked) {
    const t = SOURCE_DUT_TYPE[activeRun.source];
    if (t) return <DutManagementContainer dutType={t} />;
  }
  return render(path);
}
