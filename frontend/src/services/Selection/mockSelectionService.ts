import type { CatalogDut, WallSelectionPayload } from "./selectionService";

// Mock 模式(NEXT_PUBLIC_USE_MOCK=true):不接後端也能跑左選單。
// DUT 目錄用固定假資料(id 對齊 mockDutService 的 d1/d2/d3,中牆才選得中);
// 選擇存 localStorage + 用 BroadcastChannel 跨分頁廣播,取代後端 WS。
export const WALL_SELECTION_CHANNEL = "ivt-wall-selection";
const LS_KEY = "ivt-wall-selection-current";

const MOCK_CATALOG: CatalogDut[] = [
  { dutId: "d1", name: "SMO-A", type: "SMO", status: "online" },
  { dutId: "d2", name: "Near-RT RIC", type: "Near-RT RIC", status: "error" },
  { dutId: "d3", name: "xApp-Traffic", type: "xApp", status: "online" },
];

export const mockSelectionService = {
  async catalog(): Promise<CatalogDut[]> {
    return MOCK_CATALOG;
  },
  async current(): Promise<WallSelectionPayload | null> {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as WallSelectionPayload) : null;
    } catch {
      return null;
    }
  },
  async setSelection(payload: WallSelectionPayload): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload));
      const ch = new BroadcastChannel(WALL_SELECTION_CHANNEL);
      ch.postMessage(payload);
      ch.close();
    } catch {
      /* ignore */
    }
  },
};
