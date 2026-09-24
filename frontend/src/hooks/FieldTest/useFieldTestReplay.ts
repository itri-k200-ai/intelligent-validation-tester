"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api/client";
import type { FieldScenarioId } from "@/types/fieldTest";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type ReplayFrame = { i: number; phase: string; wall?: number | null };
export type ReplayCamera = { key: string; name: string; frames: ReplayFrame[] };
export type ReplayIndex = {
  runId: string;
  periodS: number | null;
  cameras: ReplayCamera[];
};

/**
 * 這次驗測的影像回放索引(顯示歷史紀錄時用)。
 *
 * 載具跑完之後即時串流就沒有意義了(而且多半也連不上),但平台在驗測期間
 * 有存逐格畫面。這支拿索引 —— 哪些鏡頭、各有幾張、每張屬於哪一趟;圖片本身
 * 由 <ReplayPlayer> 逐張去要 /replay/<情境>/<鏡頭>/<i>.jpg。
 *
 * 後端只回「真的有 frames」的鏡頭,所以拿到空陣列就代表這一次沒有回放可播。
 * (目前上游只有車載鏡頭有,三支固定攝影機都是 0 張 —— 平台端的狀況。)
 *
 * run_id 由後端決定,與 /missions 用同一套挑法,兩邊看到的是同一次驗測。
 * 驗測跑完才會有回放,不必追得很勤:30 秒一次,換到別筆紀錄時 queryKey 不變
 * 但內容會跟著後端換,所以照樣會更新。
 */
export function useFieldTestReplay(scenario: FieldScenarioId) {
  const query = useQuery({
    queryKey: ["field-test", scenario, "replay"],
    queryFn: async ({ signal }): Promise<ReplayIndex | null> => {
      const { data } = await apiClient.get<ReplayIndex>(
        `/field-tests/replay/${scenario}/`,
        { signal },
      );
      return data;
    },
    refetchInterval: 30000,
    retry: false,
    enabled: !USE_MOCK,
  });
  return { replay: query.data ?? null };
}
