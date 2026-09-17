"use client";
import { useQuery } from "@tanstack/react-query";

import { fieldTestService } from "@/services";
import type { FieldScenarioId } from "@/types/fieldTest";

/**
 * 場域測試(室外 UAV / 室內 AMR)目前這次任務。
 *
 * 來源由 services/index 決定:NEXT_PUBLIC_USE_MOCK=true 吃假資料,否則打
 * /api/field-tests/missions/<scenario>(後端再接外部 Performance_tester)。
 * 有趟在跑就每 2 秒回抓一次,跑完就停 —— 牆是長時間開著的,不要空轉。
 */
export function useFieldTestMission(scenario: FieldScenarioId) {
  const query = useQuery({
    queryKey: ["field-test", scenario, "mission"],
    queryFn: ({ signal }) => fieldTestService.mission(scenario, { signal }),
    // 有趟在跑就 2 秒追進度;沒在跑也要慢慢回抓,不然左螢幕換了測試或平台補了
    // 紀錄時,牆面會一直停在舊的那次。即時數值不靠這支(見 useFieldTestLive)。
    refetchInterval: (query) => {
      const running = query.state.data?.runs?.some((run) => run.status === "running");
      return running ? 2000 : 15000;
    },
  });
  return { mission: query.data ?? null };
}
