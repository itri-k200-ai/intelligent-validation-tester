"use client";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "@/services/api/client";
import type { FieldScenarioId } from "@/types/fieldTest";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

export type FieldActiveOne = {
  running: boolean;
  runId: string | null;
  /** 這一筆是什麼時候被我們看到開跑的(後端時鐘的 epoch 秒) */
  runStartedAt: number | null;
  pinnedRunId: string | null;
  /** 這個情境是什麼時候被指定看歷史的 */
  pinnedAt: number | null;
};

export type FieldActive = {
  /** 後端現在的時間 —— 讓呼叫端把上面那些時間換算成「多久以前」 */
  now: number;
  scenarios: Partial<Record<FieldScenarioId, FieldActiveOne>>;
};

/**
 * 兩個情境各自「最後一次操作」是什麼時候 —— 中牆用它決定要顯示室內還是室外。
 *
 * 規則是「最後一次操作決定顯示什麼」:驅動驗測與指定歷史都算一次操作,比時間先後。
 * 這支只回時間戳,不回樣本 —— 只為了判斷哪一邊比較新,不值得把兩邊的 mission
 * 都拉下來(那個 payload 很大)。
 *
 * 時間一律換算成「多久以前」再比(用後端一起回的 now),這樣就不必跟瀏覽器的
 * 時鐘對齊 —— 牆面機與後端機有時差也不會比錯。
 */
export function useFieldTestActive() {
  const query = useQuery({
    queryKey: ["field-test", "active"],
    queryFn: async ({ signal }): Promise<FieldActive | null> => {
      const { data } = await apiClient.get<FieldActive>("/field-tests/active/", { signal });
      return data;
    },
    refetchInterval: 1000,
    retry: false,
    enabled: !USE_MOCK,
  });
  return { active: query.data ?? null };
}
