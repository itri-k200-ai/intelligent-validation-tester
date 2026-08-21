import type { RicSourceId } from "@/config/ricSources";
import { apiClient } from "../api/client";

export type CatalogDut = {
  dutId: string;
  name: string;
  type: string;
  status: string;
};

export type WallSelectionPayload = {
  /** DUT 屬於哪一套 RICtester(Near/Non 獨立部署)。 */
  source?: RicSourceId;
  href?: string;
  label?: string;
  dutId?: string;
  // 來自 RICtester adapter 的識別(Phase 1 起,供中/右牆之後對接用)
  dutName?: string;
  scenarioId?: string;
  testcaseId?: string;
  interface?: string;
  // 左螢幕按「執行測試」後的每測項 runningId + 起跑時間
  runnings?: { testcaseId: string; runningId: string }[];
  runStartedAt?: string;
};

// 左螢幕選單用的服務。前端以自動登入的 admin JWT 呼叫,後端
// HasServiceTokenOrAdmin 放行(不需服務金鑰)。
export const selectionService = {
  async catalog(): Promise<CatalogDut[]> {
    const { data } = await apiClient.get("/selection/catalog/");
    return data;
  },
  async current(): Promise<WallSelectionPayload | null> {
    const { data } = await apiClient.get("/selection/current/");
    return data;
  },
  async setSelection(payload: WallSelectionPayload): Promise<void> {
    await apiClient.post("/selection/current/", payload);
  },
};
