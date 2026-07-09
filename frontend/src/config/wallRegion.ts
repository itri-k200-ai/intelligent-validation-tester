// ── 電視牆單螢幕拆分(執行時決定,一個 image 服務全部)────────────
// region 由 URL query 決定,部署後靠不同 URL 切左/中/右:
//   ?wall=left    → 左螢幕選單(selector)         全螢幕
//   ?wall=center  → 主牆 6×3 = (0,0) 11520×3240   → 裁切縮放
//   ?wall=right   → 右翼 3×3 = (5760,3240) 5760×3240
//   (不帶)        → all:整塊 11520×6480 預覽(筆電看全貌)
// 選定後存 sessionStorage,之後 client 端導航(router.push 會掉 query)仍保留。
export type WallRegionName = "all" | "left" | "center" | "right";

const VALID: WallRegionName[] = ["all", "left", "center", "right"];

export const WALL_REGIONS: Record<
  WallRegionName,
  { x: number; y: number; w: number; h: number }
> = {
  all: { x: 0, y: 0, w: 11520, h: 6480 },
  left: { x: 0, y: 3240, w: 5760, h: 3240 },
  center: { x: 0, y: 0, w: 11520, h: 3240 },
  right: { x: 5760, y: 3240, w: 5760, h: 3240 },
};

let cached: WallRegionName | null = null;

/** 執行時解析目前 region(client 端;SSR 一律回 all)。 */
export function getWallRegion(): WallRegionName {
  if (cached) return cached;
  if (typeof window === "undefined") return "all";
  let region: string | null = null;
  try {
    const q = new URL(window.location.href).searchParams.get("wall");
    const stored = window.sessionStorage.getItem("wall-region");
    if (q) window.sessionStorage.setItem("wall-region", q);
    region = q || stored;
  } catch {
    region = null;
  }
  cached = VALID.includes(region as WallRegionName) ? (region as WallRegionName) : "all";
  return cached;
}
