"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api/client";
import type { FieldScenarioId } from "@/types/fieldTest";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

type CameraStatus = {
  streaming?: boolean;
  viewers?: number;
  config?: { max_viewers?: number; fps?: number; width?: number; height?: number };
  stream_url?: string;
};

/**
 * 載具車載影像的狀態。
 *
 * 上游規定「先查再開」,而且同時最多 3 路(`max_viewers`),每個開著的分頁都算一路 ——
 * 所以沒在推流(或名額滿、或那台載具不通)就不要掛 <img>,免得白佔一個名額。
 * 狀態變化不快,30 秒問一次就夠。
 */
export function useFieldTestCamera(scenario: FieldScenarioId) {
  const query = useQuery({
    queryKey: ["field-test", scenario, "camera"],
    queryFn: async ({ signal }): Promise<CameraStatus> => {
      const { data } = await apiClient.get<CameraStatus>(`/field-tests/camera/${scenario}/`, { signal });
      return data;
    },
    refetchInterval: 30000,
    retry: false,
    enabled: !USE_MOCK,
  });
  const status = query.data;
  const full =
    typeof status?.viewers === "number" &&
    typeof status?.config?.max_viewers === "number" &&
    status.viewers >= status.config.max_viewers;
  return {
    streamUrl: status?.streaming && !full ? (status.stream_url ?? null) : null,
    streaming: !!status?.streaming,
    full,
  };
}
