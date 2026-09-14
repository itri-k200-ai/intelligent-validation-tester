"use client";
import { useQuery } from "@tanstack/react-query";

import { mockFieldTestService } from "@/services/FieldTest/mockFieldTestService";
import type { FieldScenarioId } from "@/types/fieldTest";

/**
 * 場域測試(室外 UAV / 室內 AMR)目前這次任務。
 *
 * 對應的 tester 還沒串,固定吃靜態假資料,所以不輪詢。串接時換成真的 service
 * (回傳同樣的 FieldMission)並加上 refetchInterval,畫面不用改。
 */
export function useFieldTestMission(scenario: FieldScenarioId) {
  const query = useQuery({
    queryKey: ["field-test", scenario, "mission"],
    queryFn: () => mockFieldTestService.mission(scenario),
  });
  return { mission: query.data ?? null };
}
