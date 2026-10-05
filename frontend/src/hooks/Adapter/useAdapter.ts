"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";

/**
 * Performance_tester adapter —— 外部團隊操作這套系統的唯一入口。
 *
 * 左牆打的是 nginx 的 /ric/im/autoTest/(代理到 adapter 的 8012),所以前端不必
 * 知道 adapter 的位址,也不會有跨來源問題。
 *
 * ⚠ 這裡**只接讀取與驅動**。adapter 另外有一組「目錄管理」(改 DUT / 情境 / 案例)
 * 與 /autoTest/_seed(重建目錄,會清掉資料)—— 那些是改資料結構的操作,放在無人
 * 看管的牆上太危險,刻意不接。
 */
const api = axios.create({ baseURL: "/ric/im/autoTest", timeout: 30_000 });

export type AdapterTestcase = {
  testcaseId: string;
  testcaseName_zh?: string | null;
  testcaseName_en?: string | null;
  testcaseDescription_zh?: string | null;
};
export type AdapterScenario = {
  scenarioId: string;
  scenarioName_zh?: string | null;
  scenarioName_en?: string | null;
  testcaseList: AdapterTestcase[];
};
export type AdapterDut = {
  dutName_zh?: string | null;
  dutName_en?: string | null;
  scenarioList: AdapterScenario[];
};

export type AdapterHistoryRow = {
  runId: string;
  runningId: string | null;
  dutName?: string | null;
  scenarioName?: string | null;
  testcaseName?: string | null;
  planName?: string | null;
  status?: string | null;
  result?: string | null;
  created?: number | null;
  finished?: number | null;
  nSamples?: number | null;
  hasReplay?: boolean;
  replayFrames?: number | null;
  notified?: boolean;
  notifiedAt?: number | null;
};

/** 可驅動的測試目錄(DUT → 情境 → 案例)。很少變,60 秒重抓一次就夠。 */
export function useAdapterCatalog() {
  return useQuery({
    queryKey: ["adapter", "testList"],
    queryFn: async ({ signal }) => (await api.get<AdapterDut[]>("/testList", { signal })).data,
    refetchInterval: 60_000,
    retry: false,
  });
}

/** 歷史驗測清單。 */
export function useAdapterHistory(limit = 50) {
  return useQuery({
    queryKey: ["adapter", "history", limit],
    queryFn: async ({ signal }) =>
      (await api.get<{ runs: AdapterHistoryRow[] }>("/history", { params: { limit }, signal })).data
        .runs ?? [],
    refetchInterval: 10_000,
    // 左牆也是一直掛著的,視窗不可見時不要停掉輪詢(同 useFieldTestActive)
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export type TriggerResult = { testcaseId: string; runningId: string | null; message: string };

/** 驅動一個測試案例 —— adapter 會去平台開一次 validation run。 */
export function useTriggerTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testcaseId: string) =>
      (
        await api.post<{ testProject: TriggerResult[] }>("/test", {
          testcaseList: [{ testcaseId }],
        })
      ).data.testProject ?? [],
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adapter", "history"] });
    },
  });
}

/** 指定中牆顯示某一筆歷史(adapter 會把它轉成 run_id 轉發給我們的後端)。 */
export function useNotifyHisShow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (runningId: string) => {
      await api.post("/test/notifyHisShow", [runningId]);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adapter", "history"] });
    },
  });
}

/** 執行中那幾筆的狀態與進度。沒有 runningId 就不打。 */
export function useRunningStatus(ids: string[]) {
  return useQuery({
    queryKey: ["adapter", "status", ids.join(",")],
    queryFn: async ({ signal }) =>
      (
        await api.post<{ runningId: string; status: string; progress: number }[]>(
          "/test/testStatus",
          ids,
          { signal },
        )
      ).data ?? [],
    enabled: ids.length > 0,
    refetchInterval: 2000,
    // 左牆也是一直掛著的,視窗不可見時不要停掉輪詢(同 useFieldTestActive)
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

/** 報告 PDF 的網址(直接開新分頁下載)。 */
export function reportUrl(runningId: string) {
  return `/ric/im/autoTest/history/${encodeURIComponent(runningId)}/report.pdf`;
}
