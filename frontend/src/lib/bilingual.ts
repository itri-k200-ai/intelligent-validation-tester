// 雙語資料層 —— 後端(autoTest v2.1 / back_end)回傳的是 *_en / *_zh 成對欄位。
// 這裡把它們保留成 { en, zh },渲染時才依語系選字(而不是抓取時就壓成單一語言),
// 這樣之後接上語系切換就能即時切換,不用重新抓資料。

export type Locale = "zh" | "en";

export type Bilingual = { en: string; zh: string };

/** 從 en/zh(可能為 undefined)組出 Bilingual;各自 fallback 到另一語言。 */
export function bi(en?: string, zh?: string): Bilingual {
  const e = (en ?? "").trim();
  const z = (zh ?? "").trim();
  return { en: e || z, zh: z || e };
}

/** 依語系選字:選不到當前語言就 fallback 另一語言,再 fallback 空字串。 */
export function pickLocale(b: Bilingual | undefined, locale: Locale): string {
  if (!b) return "";
  return locale === "en" ? b.en || b.zh : b.zh || b.en;
}
