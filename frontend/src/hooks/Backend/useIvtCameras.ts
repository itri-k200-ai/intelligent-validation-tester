"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api/client";

// IVT 通用層攝影機(環境影像)。攝影機從 RICtester 拆回 IVT apps/sites,
// 成為各 tester 共用的通用能力。端點:GET /api/cameras/(扁平列出全部)。
export type IvtCamera = {
  id: string;
  name: string;
  hls_url: string | null; // serializer 已產生 /hls/cam-<uuid>/index.m3u8
  resolution: string;
  fps: number;
  status: string; // online / offline
};

export function useIvtCameras() {
  const query = useQuery({
    queryKey: ["ivt", "cameras"],
    queryFn: async (): Promise<IvtCamera[]> => {
      const { data } = await apiClient.get<IvtCamera[]>("/cameras/");
      return data;
    },
    refetchInterval: 30000,
  });
  return {
    // 有 hls_url 才播得出來;優先顯示 online
    cameras: (query.data ?? []).filter((c) => c.hls_url),
    isLoading: query.isLoading,
  };
}
