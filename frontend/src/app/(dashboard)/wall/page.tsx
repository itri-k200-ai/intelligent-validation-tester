"use client";
import { DutManagementContainer } from "@/components/Dut/DutManagementContainer";
import { OverviewContainer } from "@/components/Overview/OverviewContainer";
import { RunRecordsContainer } from "@/components/Records/RunRecordsContainer";
import { SiteManagementContainer } from "@/components/Site/SiteManagementContainer";
import { useWallSelectionStore } from "@/stores/wallSelectionStore";
import type { DutType, Region } from "@/types/common";

/**
 * 中牆的唯一 URL。
 *
 * 中牆固定停在 /wall 不再導航 —— 左螢幕把「要顯示什麼」寫進 IVT 後端
 * (POST /api/selection/current/),這頁訂閱到之後切換渲染。
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

export default function WallPage() {
  const href = useWallSelectionStore((s) => s.selection?.href);
  return render(href);
}
