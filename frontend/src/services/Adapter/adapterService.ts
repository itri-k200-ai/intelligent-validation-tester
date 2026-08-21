// RICtester adapter(/autoTest/*)client —— 電視牆的測試資料來源。
// 同源相對路徑;dev 由 next.config rewrites 代理到 adapter(:5110),
// 正式部署由 nginx 代理。adapter 無 JWT,直接 fetch。
//
// 相容性:autoTest v2.1(RICtester commit 386ffc5)把名稱/描述改成中英雙
// 欄位(`xxx_en` / `xxx_zh`),v2.0 是單一扁平欄位。本檔在邊界統一收斂成
// 扁平欄位,下游元件不必知道 adapter 是哪一版。

import {
  RIC_SOURCES,
  ricSourceBase,
  type RicSourceId,
} from "@/config/ricSources";

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
  /** 這個 DUT 來自哪一套 tester —— 驅動測試/反查明細都要打回同一套。 */
  source: RicSourceId;
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

async function req<T>(source: RicSourceId, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(ricSourceBase(source) + path, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`adapter[${source}] ${path} -> HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

type Raw = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
/** 非物件(含 null)一律當空物件 —— 陣列裡混進 null 也不會炸。 */
const obj = (v: unknown): Raw => (typeof v === "object" && v !== null ? (v as Raw) : {});

// v2.1 的 _en / _zh 不是單純的「英文版 / 中文版」,兩者用途不同,取哪一個
// 要看該欄位在下游是當「識別碼」還是「顯示文字」用(以下對應關係都對過
// RICtester back_end 的實際資料):
//   dutName_en      = back_end registry/duts.dut_name        → 右牆反查的鍵
//   scenarioName_zh = back_end registry/projects.project_name → 對得上的是中文
//   testcaseName_en = 測項代碼(如 a1.get_policytype)        → 介面前綴靠它解析
//   *Description_*  = 純顯示文字,優先中文
/** 取識別碼欄位:_en → _zh → 舊扁平欄位。 */
function pickId(o: Raw, base: string): string {
  return str(o[`${base}_en`]) || str(o[`${base}_zh`]) || str(o[base]);
}

/** 取顯示文字欄位:_zh → _en → 舊扁平欄位。 */
function pickText(o: Raw, base: string): string {
  return str(o[`${base}_zh`]) || str(o[`${base}_en`]) || str(o[base]);
}

function normalizeTestcase(tc: Raw): AdapterTestcase {
  return {
    testcaseId: str(tc.testcaseId),
    testcaseName: pickId(tc, "testcaseName"),
    testcaseDescription: pickText(tc, "testcaseDescription"),
    method: str(tc.method),
    url: str(tc.url),
    urlParameters: arr(tc.urlParameters),
    bodyParameters: arr(tc.bodyParameters),
  };
}

function normalizeScenario(s: Raw): AdapterScenario {
  return {
    scenarioId: str(s.scenarioId),
    scenarioName: pickText(s, "scenarioName"),
    scenarioDescription: pickText(s, "scenarioDescription"),
    testcaseList: arr(s.testcaseList).map((tc) => normalizeTestcase(obj(tc))),
  };
}

function normalizeDut(d: Raw, source: RicSourceId): AdapterDut {
  return {
    dutName: pickId(d, "dutName"),
    scenarioList: arr(d.scenarioList).map((s) => normalizeScenario(obj(s))),
    source,
  };
}

export const adapterService = {
  // 全部測試資料(DUT → scenario → testcase 三層),同時抓所有來源後合併。
  // 用 allSettled —— 某一套 tester 掛了不影響其他套照常顯示。
  async testList(): Promise<AdapterDut[]> {
    const settled = await Promise.allSettled(
      RIC_SOURCES.map(async (src) => {
        const raw = await req<unknown>(src.id, "/autoTest/testList");
        return arr(raw).map((d) => normalizeDut(obj(d), src.id));
      }),
    );
    settled.forEach((r, i) => {
      if (r.status === "rejected")
        console.error(`[adapter] 來源 ${RIC_SOURCES[i].id} 取測試清單失敗:`, r.reason);
    });
    return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  },
  // 驅動一批測項 → 回每項的 runningId(adapter 回 {testProject: [...]})
  // 注意:drive 回應的 key 是 testCaseId(大寫 C),與 testList 的 testcaseId
  // 不同 —— 這裡正規化成 testcaseId。
  async drive(source: RicSourceId, testcaseIds: string[]): Promise<AdapterRunning[]> {
    const data = await req<{
      testProject: { testCaseId?: string; testcaseId?: string; runningId: string }[];
    }>(source, "/autoTest/test", {
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
  testStatus(source: RicSourceId, runningIds: string[]): Promise<AdapterStatus[]> {
    return req<AdapterStatus[]>(source, "/autoTest/test/testStatus", {
      method: "POST",
      body: JSON.stringify(runningIds),
    });
  },
  // 查一批 runningId 的結果
  testResult(source: RicSourceId, runningIds: string[]): Promise<AdapterResult[]> {
    return req<AdapterResult[]>(source, "/autoTest/test/testResult", {
      method: "POST",
      body: JSON.stringify(runningIds),
    });
  },
};
