"use client";
import { useQuery } from "@tanstack/react-query";

import type { GeoPoint } from "@/lib/geoProjection";
import { apiClient } from "@/services/api/client";
import type { FieldScenarioId } from "@/types/fieldTest";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

/** 平面座標(公尺,x 向東、y 向北)的一串點 */
type Path = [number, number][];

/**
 * 室外路線圖的底圖:平台場景的向量地圖(來源是 OSM)。
 * 座標都是公尺,原點是 center(經緯度)—— GPS 也要用同一個原點換算,軌跡才疊得上。
 */
export type FieldScene = {
  sceneId: string;
  center: GeoPoint | null;
  bounds: { xmin: number; xmax: number; ymin: number; ymax: number } | null;
  /** 建築輪廓 + 高度(公尺;上游沒給就是 null) */
  buildings: { footprint: Path; height: number | null }[];
  roads: Path[];
  greens: Path[];
};

/**
 * 室外底圖。場景幾乎不會變(後端也快取 10 分鐘),拿到一次就夠;
 * 拿不到(平台斷線、沒有對應場景)就每分鐘再試,地圖在那之前只畫軌跡。
 * 室內用的是 SLAM 底圖,不打這支。
 */
export function useFieldTestScene(scenario: FieldScenarioId) {
  const query = useQuery({
    queryKey: ["field-test", scenario, "scene"],
    queryFn: async ({ signal }): Promise<FieldScene> => {
      const { data } = await apiClient.get<FieldScene>(`/field-tests/scene/${scenario}/`, { signal });
      return data;
    },
    staleTime: 10 * 60_000,
    refetchInterval: (q) => (q.state.data ? false : 60_000),
    retry: false,
    enabled: !USE_MOCK && scenario === "outdoor",
  });
  return { scene: query.data ?? null };
}
