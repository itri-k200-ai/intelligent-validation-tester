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
    // 待命也要輪詢得勤的原因:平台指定「牆上顯示哪一筆歷史驗測」時,通知只寫進
    // Redis,要等牆面下一次輪詢才會反映到畫面 —— 這個間隔就是切換的延遲。
    // 現場按了就要看到,所以待命 1 秒、執行中 0.7 秒。
    //
    // 這麼快是安全的:這支只打平台本地的 /ext/validations/*(不經車上的
    // relay),實測 0.06~0.2 秒回。而且 refetchInterval 是「上次結束後再等」,
    // 不會疊請求 —— 實際週期 ≈ 設定值 + 上游耗時。
    refetchInterval: (query) => {
      const running = query.state.data?.runs?.some((run) => run.status === "running");
      return running ? 700 : 1000;
    },
    // 牆是長時間掛著的,而且現場是在**別的視窗**打 adapter 指定要看哪一筆 ——
    // 預設的 refetchIntervalInBackground=false 會在視窗被判定不可見時(切到別的
    // 視窗、或被另一個視窗完全蓋住,Chrome 的 occlusion 會算成 hidden)把輪詢整個
    // 停掉,牆面就不再跟著跳;加上全域的 refetchOnWindowFocus=false,回到視窗也
    // 不會補抓。實測 nginx 紀錄出現 60~215 秒完全沒有請求的空窗,就是這個。
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });
  return { mission: query.data ?? null };
}
