"use client";
import { useQuery } from "@tanstack/react-query";

import { ricBackendAll } from "@/services/Backend/ricBackendService";

export type RicCamera = {
  camera_uuid: string;
  camera_name: string;
  camera_rtsp_url: string;
  camera_resolution: string;
  camera_fps: string;
  camera_status: string;
};

/**
 * RICtester 的環境攝影機清單(影像已整併過去)。
 * HLS 播放路徑:/hls/{camera_uuid}/index.m3u8(代理到 RICtester mediamtx)。
 */
export function useRicCameras() {
  const query = useQuery({
    queryKey: ["ric", "cameras"],
    queryFn: async (): Promise<RicCamera[]> =>
      (await ricBackendAll.cameras()) as unknown as RicCamera[],
    refetchInterval: 30000,
  });
  return {
    cameras: (query.data ?? []).filter((c) => c.camera_status === "active"),
    isLoading: query.isLoading,
  };
}
