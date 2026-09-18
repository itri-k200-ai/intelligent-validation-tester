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
 * 上游規定「先查再開」,而且同時最多 3 路(`max_viewers`),每個開著的分頁都算
 * 一路 —— 所以名額滿、或那台載具不通時不要掛 <img>,免得白佔一個名額。
 *
 * ⚠ 不能拿 `streaming` 當掛不掛的前提。上游是「**有人看才推流**,閒置
 *   `idle_timeout_s`(實測 15 秒)就停」,所以沒人看的時候它一定是 false。
 *   拿它當前提會變成雞生蛋:我們等它 true 才連、它等有人連才 true ——
 *   影像只要斷過一次(例如上游或代理層逾時),streaming 轉 false,前端就
 *   再也不會重新開串流,畫面永遠回不來。實測:連上去本身就會把 streaming
 *   轉成 true、viewers 變 1。
 *
 *   所以條件只看「查得到狀態(載具通)」+「名額沒滿」。
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
    streamUrl: status && !full ? (status.stream_url ?? null) : null,
    streaming: !!status?.streaming,
    full,
  };
}
