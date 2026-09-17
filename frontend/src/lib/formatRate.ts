/**
 * 吞吐量的單位換算。
 *
 * 上游給的是 kbps 原值,實測室內閒置時 70~5000 kbps、跑流量時可能上百 Mbps ——
 * 固定用 Mbps 會變成 0.0,固定用 kbps 又會出現七位數,所以依當下數值大小選單位。
 * 同一張卡(數值、標題、折線 y 軸)要用同一個單位才對得起來,所以分成
 * 「挑單位」與「套用」兩步:挑一次,大家共用。
 */
export type RateUnit = { unit: string; scale: number; digits: number };

export function pickRateUnit(values: (number | null | undefined)[]): RateUnit {
  const nums = values.filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const max = nums.length ? Math.max(...nums.map(Math.abs)) : 0;
  if (max >= 1_000_000) return { unit: "Gbps", scale: 1_000_000, digits: 2 };
  if (max >= 1_000) return { unit: "Mbps", scale: 1_000, digits: 1 };
  return { unit: "kbps", scale: 1, digits: 0 };
}

/** 單一數值(即時數值格用):回顯示字串與單位 */
export function formatRate(kbps: number | null | undefined): { value: string | null; unit: string } {
  if (typeof kbps !== "number" || !Number.isFinite(kbps)) return { value: null, unit: "kbps" };
  const { unit, scale, digits } = pickRateUnit([kbps]);
  return { value: (kbps / scale).toFixed(digits), unit };
}
