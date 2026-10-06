"use client";

import type { FieldBackdrop, FloorPlan, FloorRect } from "@/config/floorPlans";
import { CHART_SURFACE, PHASE } from "@/lib/fieldView";
import type { FieldMission } from "@/types/fieldTest";

/**
 * 路線圖:兩趟軌跡(啟用前 / 啟用後)與載具目前位置。
 *
 * 兩種底:
 *  - 有 backdrop(圖檔 + extent):用世界座標畫,軌跡取載具實際回報的座標 ——
 *    圖與座標同一個系,不必校正。視野自動縮到活動範圍,不然整層樓只有一小段有東西。
 *  - 沒有 backdrop:畫向量平面圖與規劃路線(室外沒有底圖,就只有路線)。
 */
export function RouteMap({
  mission,
  floorPlan,
  backdrop,
  livePosition,
  realFrame = false,
}: {
  mission: FieldMission;
  floorPlan?: FloorPlan;
  backdrop?: FieldBackdrop;
  /** 即時位置(來自 /live);沒有就用目前那趟的最後位置 */
  livePosition?: { x: number; y: number } | null;
  /**
   * 軌跡與位置是真實座標(室外由 GPS 換算)—— 沒有底圖也照樣畫取樣軌跡,並且不畫
   * 寫死的示意航線:兩者座標系不同,混在一起會讓人以為照著那條線飛。
   */
  realFrame?: boolean;
}) {
  // 用取樣軌跡(真實座標)還是示意航線 + 路徑點
  const real = !!backdrop || realFrame;
  // 規劃路線只在「畫在向量平面圖上」時才畫 —— 那時的路徑點是照實際樓層描的。
  // 室外的路徑點(config 的 UAV_ROUTE)只是早期的版面示意,跟 GPS 對不上,等於假資料,
  // 所以沒有位置資料時地圖寧可空著,也不畫它。
  const planned = !real && !!floorPlan;
  const { route, runs, vehicle } = mission;
  const live = livePosition ?? runs[mission.currentRun]?.position ?? null;
  const pts = (list: { x: number; y: number }[]) => list.map((p) => `${p.x},${-p.y}`).join(" ");

  // 每趟的實際軌跡(樣本裡的座標);沒有座標的樣本(例如 UAV 只有 GPS)就沒有軌跡
  const tracks = runs.map((r) => ({
    phase: r.phase,
    points: r.samples
      .filter((s): s is typeof s & { x: number; y: number } =>
        typeof s.x === "number" && typeof s.y === "number",
      )
      .map((s) => ({ x: s.x, y: s.y })),
  }));

  // 視野:有底圖就看「軌跡 + 目前位置」,並留邊、夾在底圖範圍內
  const focus = [...tracks.flatMap((t) => t.points), ...(live ? [live] : [])];
  const view = floorPlan?.view;
  let minX: number;
  let minY: number;
  let spanX: number;
  let spanY: number;
  if (backdrop) {
    const ext = backdrop.extent;
    // 設了 view 就固定看那一塊 —— 鏡頭一直跟著軌跡縮放的話,牆上看不出 AMR 走到哪。
    // 沒設才退回「框住軌跡 + 目前位置」(留 6 m 邊,夾在底圖範圍內)。
    const margin = 6;
    const box = backdrop.view ?? {
      xMin: focus.length ? Math.max(ext.xMin, Math.min(...focus.map((p) => p.x)) - margin) : ext.xMin,
      xMax: focus.length ? Math.min(ext.xMax, Math.max(...focus.map((p) => p.x)) + margin) : ext.xMax,
      yMin: focus.length ? Math.max(ext.yMin, Math.min(...focus.map((p) => p.y)) - margin) : ext.yMin,
      yMax: focus.length ? Math.min(ext.yMax, Math.max(...focus.map((p) => p.y)) + margin) : ext.yMax,
    };
    minX = box.xMin;
    minY = -box.yMax;
    spanX = Math.max(box.xMax - box.xMin, 1);
    spanY = Math.max(box.yMax - box.yMin, 1);
  } else if (realFrame) {
    // 沒有底圖的真實座標(室外 GPS、場景還沒拿到):框住「軌跡 + 目前位置」並留邊。
    // 範圍至少 40 m —— 只有一個點時才不會放大到什麼都看不出來
    const xs = focus.length ? focus.map((p) => p.x) : [0];
    const ys = focus.length ? focus.map((p) => p.y) : [0];
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const half = Math.max(20, ((x1 - x0) / 2) * 1.1, ((y1 - y0) / 2) * 1.1);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    minX = cx - half;
    minY = -(cy + half);
    spanX = half * 2;
    spanY = half * 2;
  } else {
    const extent = view
      ? [
          { x: view.x1, y: view.y1 },
          { x: view.x2, y: view.y2 },
        ]
      : [...route, ...(live ? [live] : [])];
    const xs = extent.map((p) => p.x);
    const ys = extent.map((p) => -p.y);
    minX = Math.min(...xs);
    minY = Math.min(...ys);
    spanX = Math.max(...xs) - minX;
    spanY = Math.max(...ys) - minY;
  }
  // u = 一個視覺單位:線寬、點大小都乘它,範圍不管幾公尺比例都一致
  const u = Math.max(spanX, spanY) / 300 || 1;
  // view / backdrop 已經框好範圍,留一點點邊就好;室外沒有底圖,路線要留寬一點
  const pad = (view || real ? 3 : 20) * u;
  const start = route[0];

  return (
    <div className="relative min-h-0 flex-1">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`${minX - pad} ${minY - pad} ${spanX + pad * 2} ${spanY + pad * 2}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="測試路徑與兩趟軌跡"
      >
        <defs>
          {/* SLAM 掃出來的牆是白的,直接疊在深底上又亮又雜。染成牆面的青色系、
              壓低亮度,變成「藍圖」的感覺,軌跡與載具才跳得出來 */}
          <filter id="slam-tint" colorInterpolationFilters="sRGB">
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.42  0 0 0 0 0.78  0 0 0 0 0.85  0 0 0 0.5 0"
            />
          </filter>
          {/* 軌跡與載具的柔光:牆離得遠,純線條看起來會太細 */}
          <filter id="track-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={1.6 * u} result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <clipPath id="map-clip">
            <rect
              x={minX - pad}
              y={minY - pad}
              width={spanX + pad * 2}
              height={spanY + pad * 2}
              rx={pad}
            />
          </clipPath>
          <pattern
            id="map-grid"
            x={0}
            y={0}
            width={5}
            height={5}
            patternUnits="userSpaceOnUse"
          >
            <path d="M5 0 L0 0 L0 5" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={0.6 * u} />
          </pattern>
        </defs>
        {backdrop && (
          // 整塊裁成圓角面板 —— 底圖比視野大,不裁的話會溢出到 SVG 的留白區
          <g clipPath="url(#map-clip)">
            {/* 底板 + 5 m 格線:讓地圖看起來是一塊面板,也給得出距離感 */}
            <rect
              x={minX - pad}
              y={minY - pad}
              width={spanX + pad * 2}
              height={spanY + pad * 2}
              fill="rgba(10,23,47,0.55)"
            />
            <image
              href={backdrop.src}
              x={backdrop.extent.xMin}
              y={-backdrop.extent.yMax}
              width={backdrop.extent.xMax - backdrop.extent.xMin}
              height={backdrop.extent.yMax - backdrop.extent.yMin}
              preserveAspectRatio="none"
              filter="url(#slam-tint)"
            />
            <rect
              x={minX - pad}
              y={minY - pad}
              width={spanX + pad * 2}
              height={spanY + pad * 2}
              fill="url(#map-grid)"
            />
            <rect
              x={minX - pad}
              y={minY - pad}
              width={spanX + pad * 2}
              height={spanY + pad * 2}
              rx={pad}
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={0.8 * u}
            />
          </g>
        )}
        {!backdrop && floorPlan && <FloorPlanLayer plan={floorPlan} u={u} />}
        {planned && (
          <polyline
            points={pts(route)}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth={2 * u}
            strokeDasharray={`${7 * u} ${6 * u}`}
            strokeLinejoin="round"
          />
        )}
        {/* 先畫啟用前、再畫啟用後,重疊的路段以啟用後為準 */}
        {real
          ? tracks.map((t) =>
              t.points.length > 1 ? (
                <g key={t.phase} filter="url(#track-glow)">
                  <polyline
                    points={pts(t.points)}
                    fill="none"
                    stroke={PHASE[t.phase].color}
                    strokeWidth={2.5 * u}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  {/* 起點畫空心圈、終點畫實心點 —— 一眼看得出走的方向 */}
                  <circle
                    cx={t.points[0].x}
                    cy={-t.points[0].y}
                    r={4 * u}
                    fill="none"
                    stroke={PHASE[t.phase].color}
                    strokeWidth={1.8 * u}
                  />
                  <circle
                    cx={t.points[t.points.length - 1].x}
                    cy={-t.points[t.points.length - 1].y}
                    r={3.2 * u}
                    fill={PHASE[t.phase].color}
                  />
                </g>
              ) : null,
            )
          : planned &&
            runs.map((r) =>
              r.reachedWaypoints > 0 ? (
                <polyline
                  key={r.phase}
                  points={pts([...route.slice(0, r.reachedWaypoints), ...(r.position ? [r.position] : [])])}
                  fill="none"
                  stroke={PHASE[r.phase].color}
                  strokeWidth={2.5 * u}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ) : null,
            )}
        {/* RU 疊在軌跡上面,路徑經過 RU 時才不會被蓋掉。RU 座標屬於向量平面圖 */}
        {!backdrop &&
          floorPlan?.radios.map((ru) => (
            <g key={ru.id} transform={`translate(${ru.x} ${-ru.y})`}>
              <circle r={5.5 * u} fill={CHART_SURFACE} stroke={RADIO_RING} strokeWidth={1.2 * u} />
              <circle r={2 * u} fill={RADIO_RING} />
            </g>
          ))}
        {planned && start && (
          <circle cx={start.x} cy={-start.y} r={6 * u} fill="#4C8DFF" stroke="#0A172F" strokeWidth={1.5 * u} />
        )}
        {live && (
          <g className="field-live-marker" filter="url(#track-glow)" transform={`translate(${live.x} ${-live.y})`}>
            {/* 標記整體縮約三成(光暈 16→11、外圈 11→7.5、箭頭 1.2→0.85):
                軌跡線收細之後,原本的尺寸會把一小段路徑整個蓋住 */}
            <circle r={11 * u} fill="#80FFE8" fillOpacity={0.18} />
            <circle r={7.5 * u} fill="none" stroke="#80FFE8" strokeOpacity={0.55} strokeWidth={0.8 * u} />
            {/* 箭頭圖形朝上、SVG rotate 順時針,headingDeg 後端已由 SLAM yaw 換算過(0 = 正北) */}
            <path
              d="M0,-10 L7.5,8 L0,4 L-7.5,8 Z"
              transform={`rotate(${vehicle.headingDeg ?? 0}) scale(${0.85 * u})`}
              fill="#80FFE8"
              stroke="#0A172F"
              strokeWidth={1.2}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

/** 平面圖的線:壓暗,路徑與載具才跳得出來 */
const PLAN_LINE = "rgba(255,255,255,0.22)";
const PLAN_OUTLINE = "rgba(255,255,255,0.45)";
export const RADIO_RING = "rgba(255,255,255,0.85)";

/** 室內平面圖底圖:外牆、隔間、電梯樓梯(交叉線);RU 由 RouteMap 疊在軌跡上。只畫線不寫字,地圖跨拼接縫 */
function FloorPlanLayer({ plan, u }: { plan: FloorPlan; u: number }) {
  const box = (r: FloorRect) => ({
    x: Math.min(r.x1, r.x2),
    y: -Math.max(r.y1, r.y2),
    width: Math.abs(r.x2 - r.x1),
    height: Math.abs(r.y2 - r.y1),
  });
  return (
    <g fill="none" stroke={PLAN_LINE} strokeWidth={0.8 * u}>
      {plan.rooms.map((r, i) => (
        <rect key={`room-${i}`} {...box(r)} fill="rgba(255,255,255,0.03)" />
      ))}
      {plan.cores.map((r, i) => {
        const b = box(r);
        return (
          <g key={`core-${i}`}>
            <rect {...b} />
            <path
              d={`M${b.x},${b.y} L${b.x + b.width},${b.y + b.height} M${b.x + b.width},${b.y} L${b.x},${b.y + b.height}`}
              strokeWidth={0.5 * u}
            />
          </g>
        );
      })}
      {plan.walls.map((w, i) => (
        <line key={`wall-${i}`} x1={w.x1} y1={-w.y1} x2={w.x2} y2={-w.y2} />
      ))}
      <rect {...box(plan.outline)} stroke={PLAN_OUTLINE} strokeWidth={1.4 * u} />
    </g>
  );
}

