// RICtester back_end(/api/back_end/*)client —— 中/右牆的「完整資料」來源。
// 與 adapter(左牆)分離:這裡直接打 RICtester 既有的 read API 拿全欄位。
//
// 認證:back_end 用 token(login 回 token,之後帶 Authorization: Bearer)。
// 自動登入預設 admin,token 快取在模組層級(單一操作員情境)。
// 全部 read 都是 POST /api/back_end/{module}/{table}/read,body 當 filter,
// 回 { data: [...] }。

import {
  DEFAULT_RIC_SOURCE,
  RIC_SOURCES,
  ricSourceBase,
  type RicSourceId,
} from "@/config/ricSources";

const CREDS = { manager_name: "admin", password: "admin1234" };

// 每一套 tester 各自登入、各自快取 token(它們是獨立部署、獨立帳號體系)。
const tokenCache = new Map<RicSourceId, string>();
const loginInFlight = new Map<RicSourceId, Promise<string>>();

async function login(source: RicSourceId): Promise<string> {
  const res = await fetch(`${ricSourceBase(source)}/api/back_end/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDS),
  });
  if (!res.ok) throw new Error(`RICtester[${source}] login failed: HTTP ${res.status}`);
  const data = await res.json();
  const token = data.token as string;
  tokenCache.set(source, token);
  return token;
}

async function getToken(source: RicSourceId): Promise<string> {
  const cached = tokenCache.get(source);
  if (cached) return cached;
  let p = loginInFlight.get(source);
  if (!p) {
    p = login(source).finally(() => loginInFlight.delete(source));
    loginInFlight.set(source, p);
  }
  return p;
}

// 通用 read:回該表符合 filter 的資料列陣列。token 過期(401)自動重登一次。
export async function ricRead<T = Record<string, unknown>>(
  module: string,
  table: string,
  filter: Record<string, unknown> = {},
  source: RicSourceId = DEFAULT_RIC_SOURCE,
): Promise<T[]> {
  const call = async (token: string) => {
    const res = await fetch(`${ricSourceBase(source)}/api/back_end/${module}/${table}/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(filter),
    });
    return res;
  };

  let res = await call(await getToken(source));
  if (res.status === 401) {
    tokenCache.delete(source);
    res = await call(await getToken(source));
  }
  if (!res.ok) throw new Error(`ricRead[${source}] ${module}/${table} -> HTTP ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as T[];
}

/**
 * 同一張表跨所有來源讀取後合併,每列補上 `__source` 標記出處。
 * 某一套失敗不影響其他套(牆上寧可少一套資料,也不要整區空白)。
 */
export async function ricReadAll<T = Record<string, unknown>>(
  module: string,
  table: string,
  filter: Record<string, unknown> = {},
): Promise<(T & { __source: RicSourceId })[]> {
  const settled = await Promise.allSettled(
    RIC_SOURCES.map(async (src) => {
      const rows = await ricRead<T>(module, table, filter, src.id);
      return rows.map((r) => ({ ...r, __source: src.id }));
    }),
  );
  settled.forEach((r, i) => {
    if (r.status === "rejected")
      console.error(`[ricBackend] 來源 ${RIC_SOURCES[i].id} 讀 ${module}/${table} 失敗:`, r.reason);
  });
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

// registry 表的便捷讀取。source 省略時讀預設那一套;要跨來源用 ricBackendAll。
export const ricBackend = {
  duts: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("registry", "duts", filter, source),
  dutEndpoints: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("registry", "dut_endpoints", filter, source),
  projects: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("registry", "projects", filter, source),
  testcases: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("registry", "testcases", filter, source),
  suites: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("registry", "suites", filter, source),
  suiteItems: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("registry", "suite_items", filter, source),
  cameras: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("registry", "cameras", filter, source),
  testRuns: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("scheduler", "test_runs", filter, source),
  caseResults: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("oracle", "case_results", filter, source),
  // 執行紀錄(探針原始 stdout)—— 中牆/測試紀錄的執行紀錄框用
  probeLogs: (filter?: Record<string, unknown>, source?: RicSourceId) =>
    ricRead("provisioner", "probe_logs", filter, source),
};

// 跨所有來源合併的版本(測試紀錄、攝影機這類「不分來源全都要」的場景)。
export const ricBackendAll = {
  duts: (filter?: Record<string, unknown>) => ricReadAll("registry", "duts", filter),
  projects: (filter?: Record<string, unknown>) => ricReadAll("registry", "projects", filter),
  cameras: (filter?: Record<string, unknown>) => ricReadAll("registry", "cameras", filter),
  testRuns: (filter?: Record<string, unknown>) => ricReadAll("scheduler", "test_runs", filter),
  probeLogs: (filter?: Record<string, unknown>) => ricReadAll("provisioner", "probe_logs", filter),
};
