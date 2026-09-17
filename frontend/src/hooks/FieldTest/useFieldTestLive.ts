"use client";
import { useQuery } from "@tanstack/react-query";

import { fieldTestService } from "@/services";
import type { FieldScenarioId, FieldVehicleStatus, LinkQuality } from "@/types/fieldTest";

/** 即時數值的形狀(後端 /api/field-tests/live/<scenario>/ 回的) */
export type FieldLive = {
  ts?: string | number | null;
  link: LinkQuality | null;
  vehicle: FieldVehicleStatus;
  position: { x: number; y: number } | null;
};

/**
 * 載具的即時數值(訊號、速度、電量、位置)。
 *
 * 和 useFieldTestMission 分開:即時值跟「有沒有在跑驗測」無關,牆上永遠要是現在的值,
 * 所以固定每 1.5 秒抓一次。上游 /live 的取樣大約 1 秒一筆,再快也沒有新資料。
 */
export function useFieldTestLive(scenario: FieldScenarioId) {
  const query = useQuery({
    queryKey: ["field-test", scenario, "live"],
    // 帶 signal:切換情境(或離開頁面)時直接中斷,壞掉的那台才不會一直佔著後端
    queryFn: ({ signal }) => fieldTestService.live(scenario, signal),
    // 上游 /live 約 2 秒一筆,而且一趟來回要 2~4 秒 —— 設 1.5 秒只會讓請求互相堆疊。
    // refetchInterval 是「上次結束後再等」,所以 3 秒等於實際 5~7 秒更新一次。
    refetchInterval: 3000,
    refetchIntervalInBackground: false,
    // 失敗不重試:下一輪很快就來,重試只會把上游塞得更慢
    retry: false,
  });
  return { live: query.data ?? null, isError: query.isError };
}
