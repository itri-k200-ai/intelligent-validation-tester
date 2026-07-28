// RICtester adapter(/autoTest/*)client —— 電視牆的測試資料來源。
// 同源相對路徑;dev 由 next.config rewrites 代理到 adapter(:5110),
// 正式部署由 nginx 代理。adapter 無 JWT,直接 fetch。

export type AdapterTestcase = {
  testcaseId: string;
  testcaseName: string;
  testcaseDescription: string;
  method: string;
  url: string;
  urlParameters: unknown[];
  bodyParameters: unknown[];
};

export type AdapterScenario = {
  scenarioId: string;
  scenarioName: string;
  scenarioDescription: string;
  testcaseList: AdapterTestcase[];
};

export type AdapterDut = {
  dutName: string;
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

export const adapterService = {
  // 全部測試資料(DUT → scenario → testcase 三層)
  testList(): Promise<AdapterDut[]> {
    return req<AdapterDut[]>("/autoTest/testList");
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
