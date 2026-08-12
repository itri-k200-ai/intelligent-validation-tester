// RICtester back_end(/api/back_end/*)client —— 中/右牆的「完整資料」來源。
// 與 adapter(左牆)分離:這裡直接打 RICtester 既有的 read API 拿全欄位。
//
// 認證:back_end 用 token(login 回 token,之後帶 Authorization: Bearer)。
// 自動登入預設 admin,token 快取在模組層級(單一操作員情境)。
// 全部 read 都是 POST /api/back_end/{module}/{table}/read,body 當 filter,
// 回 { data: [...] }。

const LOGIN_URL = "/api/back_end/auth/login";
const CREDS = { manager_name: "admin", password: "admin1234" };

let tokenCache: string | null = null;
let loginInFlight: Promise<string> | null = null;

async function login(): Promise<string> {
  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(CREDS),
  });
  if (!res.ok) throw new Error(`RICtester login failed: HTTP ${res.status}`);
  const data = await res.json();
  tokenCache = data.token as string;
  return tokenCache;
}

async function getToken(): Promise<string> {
  if (tokenCache) return tokenCache;
  if (!loginInFlight) loginInFlight = login().finally(() => (loginInFlight = null));
  return loginInFlight;
}

// 通用 read:回該表符合 filter 的資料列陣列。token 過期(401)自動重登一次。
export async function ricRead<T = Record<string, unknown>>(
  module: string,
  table: string,
  filter: Record<string, unknown> = {},
): Promise<T[]> {
  const call = async (token: string) => {
    const res = await fetch(`/api/back_end/${module}/${table}/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(filter),
    });
    return res;
  };

  let res = await call(await getToken());
  if (res.status === 401) {
    tokenCache = null;
    res = await call(await getToken());
  }
  if (!res.ok) throw new Error(`ricRead ${module}/${table} -> HTTP ${res.status}`);
  const json = await res.json();
  return (json.data ?? []) as T[];
}

// registry 表的便捷讀取
export const ricBackend = {
  duts: (filter?: Record<string, unknown>) => ricRead("registry", "duts", filter),
  dutEndpoints: (filter?: Record<string, unknown>) =>
    ricRead("registry", "dut_endpoints", filter),
  projects: (filter?: Record<string, unknown>) => ricRead("registry", "projects", filter),
  testcases: (filter?: Record<string, unknown>) => ricRead("registry", "testcases", filter),
  suites: (filter?: Record<string, unknown>) => ricRead("registry", "suites", filter),
  suiteItems: (filter?: Record<string, unknown>) =>
    ricRead("registry", "suite_items", filter),
  // 攝影機已移至 IVT 通用層(useIvtCameras → /api/cameras/),RICtester 不再供應
  testRuns: (filter?: Record<string, unknown>) => ricRead("scheduler", "test_runs", filter),
  caseResults: (filter?: Record<string, unknown>) =>
    ricRead("oracle", "case_results", filter),
  // 每次 run 從探針容器抓的原始 stdout(戰情牆「測試過程」的終端機日誌來源)
  probeLogs: (filter?: Record<string, unknown>) =>
    ricRead("provisioner", "probe_logs", filter),
};
