import type { FieldMission } from "@/types/fieldTest";

/** GPS 座標(度) */
export type GeoPoint = { lat: number; lon: number };

/** 地球平均半徑(公尺) */
const EARTH_RADIUS_M = 6_371_008.8;

/**
 * 把 GPS 換成以 origin 為原點的平面公尺座標(x 向東、y 向北)—— 跟室內 SLAM、
 * 路徑點用同一種座標慣例,地圖元件就能用同一套邏輯畫軌跡與位置。
 *
 * 用等距圓柱投影:場域只有幾百公尺,誤差遠小於 GPS 本身的誤差,不必上完整的地圖投影。
 * 之後有了室外底圖,把 origin 換成底圖的基準點即可。
 */
export function makeGeoProjector(origin: GeoPoint) {
  const rad = Math.PI / 180;
  const cosLat = Math.cos(origin.lat * rad);
  return (p: GeoPoint) => ({
    x: (p.lon - origin.lon) * rad * EARTH_RADIUS_M * cosLat,
    y: (p.lat - origin.lat) * rad * EARTH_RADIUS_M,
  });
}

/** 驗測取樣裡第一個有 GPS 的點(依趟次順序)—— 當作投影原點,兩趟才會在同一個座標系 */
export function firstGeo(mission: FieldMission): GeoPoint | null {
  for (const run of mission.runs) {
    const s = run.samples.find((pt) => typeof pt.lat === "number" && typeof pt.lon === "number");
    if (s) return { lat: s.lat as number, lon: s.lon as number };
  }
  return null;
}

/** 取樣的 GPS 換成 x / y(公尺),其餘欄位不動;沒有 GPS 的取樣原樣保留 */
export function projectMission(mission: FieldMission, project: (p: GeoPoint) => { x: number; y: number }) {
  return {
    ...mission,
    runs: mission.runs.map((run) => ({
      ...run,
      samples: run.samples.map((pt) =>
        typeof pt.lat === "number" && typeof pt.lon === "number"
          ? { ...pt, ...project({ lat: pt.lat, lon: pt.lon }) }
          : pt,
      ),
    })),
  };
}
