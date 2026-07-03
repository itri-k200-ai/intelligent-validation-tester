// ── 電視牆單螢幕拆分 ─────────────────────────────────────────────
// 三面實體牆各自跑在不同 port,由 build 時的 NEXT_PUBLIC_WALL_REGION 決定
// 這個 build 是哪一面:
//   all    :整塊 11520×6480 預覽(:8080,筆電看全貌用,預設)
//   center :主牆 6×3 = (0,0) 11520×3240        → :8081
//   right  :右翼 3×3 = (5760,3240) 5760×3240   → :8082
// 左翼(原 Sidebar)已改由獨立的 selector app(:3100)負責。
//
// 座標系是 WallModeApplier / globals.css 用的 11520×6480 邏輯畫布。
export type WallRegionName = "all" | "center" | "right";

export const WALL_REGIONS: Record<
  WallRegionName,
  { x: number; y: number; w: number; h: number }
> = {
  all: { x: 0, y: 0, w: 11520, h: 6480 },
  center: { x: 0, y: 0, w: 11520, h: 3240 },
  right: { x: 5760, y: 3240, w: 5760, h: 3240 },
};

export const WALL_REGION: WallRegionName =
  (process.env.NEXT_PUBLIC_WALL_REGION as WallRegionName) || "all";
