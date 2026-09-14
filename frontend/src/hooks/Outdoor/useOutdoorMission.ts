"use client";
import { useQuery } from "@tanstack/react-query";

import { mockOutdoorService } from "@/services/Outdoor/mockOutdoorService";

/**
 * 室外 UAV 情境目前這趟任務。
 *
 * 室外 tester 還沒串,固定吃靜態假資料,所以不輪詢。串接時換成真的 service
 * (回傳同樣的 OutdoorMission)並加上 refetchInterval,畫面不用改。
 */
export function useOutdoorMission() {
  const query = useQuery({
    queryKey: ["outdoor", "mission"],
    queryFn: () => mockOutdoorService.mission(),
  });
  return { mission: query.data ?? null };
}
