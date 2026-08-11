// RICtester adapter(/autoTest/*)client —— 電視牆的測試資料來源。
// 同源相對路徑;dev 由 next.config rewrites 代理到 adapter(:5110),
// 正式部署由 nginx 代理。adapter 無 JWT,直接 fetch。

import { bi, type Bilingual } from "@/lib/bilingual";

export type AdapterTestcase = {
  testcaseId: string;
  testcaseName: string; // 機器碼(e2.setup)—— 識別/判介面/對型錄用,語言中性
  testcaseDescription: string; // 扁平(中文優先),舊下游相容用
  testcaseDescriptionI18n: Bilingual; // 顯示端依語系選字
  method: string;
  url: string;
  urlParameters: unknown[];
  bodyParameters: unknown[];
};

export type AdapterScenario = {
  scenarioId: string;
  scenarioName: string; // 扁平(中文優先),舊下游相容用
  scenarioNameI18n: Bilingual;
  scenarioDescription: string;
  scenarioDescriptionI18n: Bilingual;
  testcaseList: AdapterTestcase[];
};

export type AdapterDut = {
  dutName: string; // 穩定識別碼(store key / WS payload / 反查)—— 不隨語系變
  dutNameI18n: Bilingual; // 顯示端依語系選字
  scenarioList: AdapterScenario[];
};

// 驅動後回傳的每個測項執行(runningId)
export type AdapterRunning = {
  testcaseId: string;
  runningId: string;
};

export type AdapterStatus = {
  runningId: string;
  status: string; // finished / running / error
  progress: number;
};

export type AdapterResult = {
  runningId: string;
  result: string; // passed / failed / error
  resultDescription: string;
};

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`adapter ${path} -> HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

// autoTest v2.1 起 testList 改雙語欄位(dutName_en/_zh、testcaseName_en/_zh…)。
// 這裡正規化回扁平格式(中文優先、fallback 英文、再 fallback 舊扁平欄位),
// 下游元件維持用 dutName / scenarioName / testcaseName,不用改。
type RawTc = Record<string, unknown>;
const pick = (o: RawTc, base: string): string =>
  (o[`${base}_zh`] as string) || (o[`${base}_en`] as string) || (o[base] as string) || "";
// 從 *_en / *_zh(fallback 舊扁平欄位)組出 Bilingual,保留兩語言給渲染時選字。
const biOf = (o: RawTc, base: string): Bilingual =>
  bi(
    (o[`${base}_en`] as string) || (o[base] as string),
    (o[`${base}_zh`] as string) || (o[base] as string),
  );

function normalizeDut(d: RawTc): AdapterDut {
  return {
    dutName: pick(d, "dutName"),
    dutNameI18n: biOf(d, "dutName"),
    scenarioList: ((d.scenarioList as RawTc[]) ?? []).map((s) => ({
      scenarioId: (s.scenarioId as string) ?? "",
      scenarioName: pick(s, "scenarioName"),
      scenarioNameI18n: biOf(s, "scenarioName"),
      scenarioDescription: pick(s, "scenarioDescription"),
      scenarioDescriptionI18n: biOf(s, "scenarioDescription"),
      testcaseList: ((s.testcaseList as RawTc[]) ?? []).map((tc) => ({
        testcaseId: (tc.testcaseId as string) ?? "",
        // testcaseName 是機器代碼(e2.setup)—— 下游拿它判介面 + 對型錄,
        // 必須用英文代碼(_en),不能用中文顯示名。語言中性,不做雙語。
        testcaseName:
          (tc.testcaseName_en as string) ||
          (tc.testcaseName as string) ||
          (tc.testcaseName_zh as string) ||
          "",
        testcaseDescription: pick(tc, "testcaseDescription"),
        testcaseDescriptionI18n: biOf(tc, "testcaseDescription"),
        method: (tc.method as string) ?? "",
        url: (tc.url as string) ?? "",
        urlParameters: (tc.urlParameters as unknown[]) ?? [],
        bodyParameters: (tc.bodyParameters as unknown[]) ?? [],
      })),
    })),
  };
}

export const adapterService = {
  // 全部測試資料(DUT → scenario → testcase 三層);相容 v2.1 雙語格式
  async testList(): Promise<AdapterDut[]> {
    const raw = await req<RawTc[]>("/autoTest/testList");
    return raw.map(normalizeDut);
  },
  // 驅動一批測項 → 回每項的 runningId(adapter 回 {testProject: [...]})
  // 注意:drive 回應的 key 是 testCaseId(大寫 C),與 testList 的 testcaseId
  // 不同 —— 這裡正規化成 testcaseId。
  async drive(testcaseIds: string[]): Promise<AdapterRunning[]> {
    const data = await req<{
      testProject: { testCaseId?: string; testcaseId?: string; runningId: string }[];
    }>("/autoTest/test", {
      method: "POST",
      body: JSON.stringify({
        testcaseList: testcaseIds.map((id) => ({ testcaseId: id })),
      }),
    });
    return (data.testProject ?? []).map((p) => ({
      testcaseId: p.testCaseId ?? p.testcaseId ?? "",
      runningId: p.runningId,
    }));
  },
  // 查一批 runningId 的狀態
  testStatus(runningIds: string[]): Promise<AdapterStatus[]> {
    return req<AdapterStatus[]>("/autoTest/test/testStatus", {
      method: "POST",
      body: JSON.stringify(runningIds),
    });
  },
  // 查一批 runningId 的結果
  testResult(runningIds: string[]): Promise<AdapterResult[]> {
    return req<AdapterResult[]>("/autoTest/test/testResult", {
      method: "POST",
      body: JSON.stringify(runningIds),
    });
  },
};
