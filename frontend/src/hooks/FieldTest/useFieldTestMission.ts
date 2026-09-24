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
    // 有趟在跑就 1 秒追進度(軌跡線與右邊圖表都吃這支);沒在跑 2 秒。
    // 即時數值不靠這支(見 useFieldTestLive)。
    //
    // 待命也要 2 秒的原因:平台指定「牆上顯示哪一筆歷史驗測」時,通知只寫進
    // Redis,要等牆面下一次輪詢才會反映到畫面 —— 這個間隔就是切換的延遲。
    // 原本 15 秒會讓現場等上最多 15 秒,而顯示歷史紀錄時牆面正好是待命狀態。
    //
    // 這麼快是安全的:這支只打平台本地的 /ext/validations/*(不經車上的
    // relay),實測 0.06~0.2 秒回。而且 refetchInterval 是「上次結束後再等」,
    // 不會疊請求 —— 實際週期 ≈ 設定值 + 上游耗時。
    refetchInterval: (query) => {
      const running = query.state.data?.runs?.some((run) => run.status === "running");
      return running ? 1000 : 2000;
    },
  });
  return { mission: query.data ?? null };
}
