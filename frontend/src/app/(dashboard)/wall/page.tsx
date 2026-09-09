"use client";
import { DutManagementContainer } from "@/components/Dut/DutManagementContainer";
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

function render(href: string | undefined) {
  const path = (href ?? "/overview").split("?")[0].replace(/\/+$/, "") || "/overview";

  if (path === "/test-records") return <RunRecordsContainer />;

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

export default function WallPage() {
  const href = useWallSelectionStore((s) => s.selection?.href);
  const { activeRun } = useRicActiveRun();

  // 有測試在跑就直接顯示測試畫面 —— selection 沒被設過(新機、Redis 重
  // 啟後)也一樣,不會停在總覽把執行中的測試漏掉。
  if (activeRun) {
    const t = SOURCE_DUT_TYPE[activeRun.source];
    if (t) return <DutManagementContainer dutType={t} />;
  }
  return render(href);
}
