"use client";
import { create } from "zustand";

import type { FieldScenarioId } from "@/types/fieldTest";

type FieldScenarioState = {
  /** 中牆目前顯示哪一個場域情境 */
  scenario: FieldScenarioId;
  /** 中牆是不是正在顯示場域測試 —— 決定標題下方要不要出現切換鈕 */
  active: boolean;
  setScenario: (s: FieldScenarioId) => void;
  setActive: (v: boolean) => void;
};

/**
 * 室外 / 室內合在一頁(/smart-network),用標題下方的按鈕切換。
 *
 * 切換鈕在 WallWarRoomLayout 的 topbar(「專案:XXX」下面),畫面內容在 main 裡,
 * 兩邊不同層級,所以狀態放 store。中牆的 URL 固定是 /wall、顯示什麼由 selection 決定,
 * layout 光看 pathname 不知道現在是不是場域測試,因此由畫面元件掛載時設 active。
 *
 * 不用 persist:牆面重開就回預設的室外,不要記住上一次現場按過什麼。
 */
export const useFieldScenarioStore = create<FieldScenarioState>((set) => ({
  scenario: "outdoor",
  active: false,
  setScenario: (scenario) => set({ scenario }),
  setActive: (active) => set({ active }),
}));
