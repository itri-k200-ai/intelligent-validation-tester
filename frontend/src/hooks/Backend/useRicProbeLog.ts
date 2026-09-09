"use client";
import { useQuery } from "@tanstack/react-query";

import { ricBackend } from "@/services/Backend/ricBackendService";

export type RicProbeLog = {
  log_uuid: string;
  probe_iface: string;
  probe_kind: string;
  probe_container_id: string;
  probe_endpoint: string;
  captured_at: string;
  log_text: string;
  f_run_uuid: string;
};

/**
 * 目前 DUT / 介面最近一次的探針原始 stdout(戰情牆「探針日誌」)。
 * 傳入候選端點位址(選了介面 → 該介面端點;沒選 → 該 DUT 全部端點),
 * 比對 probe_endpoint,取 captured_at 最新的一筆。輪詢讓執行後很快更新。
 *
 * 註:back_end 的 nosql read 只允許用 f_*_uuid 過濾,probe_endpoint 會被忽略,
 * 所以抓回全部再在前端比對(單操作員 + 資料量小,可接受)。
 */
export function useRicProbeLog(
  endpoints: string[],
  opts?: { enabled?: boolean; baselineUuid?: string | null },
) {
  const keyStr = endpoints.slice().sort().join(",");
  const baselineUuid = opts?.baselineUuid ?? null;
  const enabled = (opts?.enabled ?? true) && endpoints.length > 0;
  const query = useQuery({
    queryKey: ["ric", "probe-log", keyStr, baselineUuid],
    enabled,
    queryFn: async (): Promise<RicProbeLog | null> => {
      const rows = (await ricBackend.probeLogs({})) as RicProbeLog[];
      const wanted = new Set(endpoints);
      const matched = rows.filter((r) => wanted.has(r.probe_endpoint));
      matched.sort((a, b) => (a.captured_at < b.captured_at ? 1 : -1));
      const latest = matched[0] ?? null;
      // 最新一筆還是基準(=本次執行前就存在的那筆)→ 本次的 log 尚未產生,回 null
      if (latest && baselineUuid && latest.log_uuid === baselineUuid) return null;
      return latest;
    },
    refetchInterval: 3000,
  });
  return { log: query.data ?? null, isLoading: query.isLoading };
}
