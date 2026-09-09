"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Locale } from "@/lib/bilingual";

type LocaleState = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggle: () => void;
};

/**
 * 顯示語系(zh / en)。後端雙語資料(DUT / scenario / 描述…)渲染時依這裡選字。
 * 預設中文;用 persist 記到 localStorage,重整 / 重開分頁維持選擇。
 *
 * 語言切換 UI 尚未接 —— 之後在牆上放一個 中/EN 切換鈕呼叫 setLocale / toggle 即可,
 * 全牆會即時換語言(資料層已就緒,不需重新抓資料)。
 */
export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: "zh",
      setLocale: (locale) => set({ locale }),
      toggle: () => set({ locale: get().locale === "zh" ? "en" : "zh" }),
    }),
    { name: "ivt-locale" },
  ),
);

export const useLocale = () => useLocaleStore((s) => s.locale);
