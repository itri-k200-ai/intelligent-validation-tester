// 共通性測試平台會打進 tester adapter 的操作清單。
//
// 依 docs/外部文件/後端規格/2026-08-28_共通性測試平台與tester介接之整合測項.pdf
// 的 26 個測項整理成 11 支 API。左螢幕的模擬器照這份清單發送請求,
// 用途是「模擬其他團隊會怎麼打我們」,不是給現場操作員用的正式介面。
//
// 成功一律 200 + 代碼 0x000;失敗 400 + 各自的錯誤代碼。
//
// body 格式是照 rictester/adapter/autotest/views.py 實際讀的欄位寫的
// (PDF 只列了 URL 與錯誤碼,沒有 body 規格)。已用 testStatus / testResult
// 對真實服務驗證過錯誤碼與格式;寫入類的尚未實跑。

import { ricSourceBase, type RicSourceId } from "@/config/ricSources";

/**
 * 送出時的額外脈絡 —— 有些操作光靠扁平的字串參數組不出 body。
 * 目前只有「驅動測試」需要:它以**案例**為單位,body 要帶該案例底下
 * 全部測項的 id,而那份清單要查目錄才知道。
 */
export type OpContext = {
  /** 目前選定案例底下的所有 testcaseId(依 testList 的順序)。 */
  scenarioTestcaseIds?: string[];
};

export type AdapterOp = {
  /** 規格文件裡的測項編號,對照用 */
  no: number;
  group: string;
  label: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
  /** {scenarioId} 之類的佔位會用 params 代入 */
  path: string;
  /** 規格定義的失敗代碼 */
  errorCode: string;
  /** 這支需要哪些參數(佔位或 body 用) */
  needs?: ("scenarioId" | "testcaseId" | "runningId" | "dutName" | "name")[];
  /** 依參數組出 request body;回 undefined 代表不帶 body */
  body?: (p: Record<string, string>, ctx?: OpContext) => unknown;
};

export const ADAPTER_OPS: AdapterOp[] = [
  {
    no: 1,
    group: "查詢",
    label: "取得測試案例與項目",
    method: "GET",
    path: "/autoTest/testList",
    errorCode: "0x101",
  },
  {
    no: 3,
    group: "測試案例",
    label: "新增測試案例",
    method: "POST",
    path: "/autoTest/testList/scenario",
    errorCode: "0x102",
    needs: ["dutName", "name"],
    // adapter 收 { dutName, scenarioList: [...] },不是單一 scenarioName
    body: (p) => ({
      dutName: p.dutName,
      scenarioList: [{ scenarioName: p.name, scenarioDescription: "" }],
    }),
  },
  {
    no: 5,
    group: "測試案例",
    label: "更新測試案例",
    method: "PUT",
    path: "/autoTest/testList/scenario",
    errorCode: "0x104",
    needs: ["scenarioId", "name"],
    body: (p) => ({
      scenarioList: [{ scenarioId: p.scenarioId, scenarioName: p.name }],
    }),
  },
  {
    no: 7,
    group: "測試案例",
    label: "刪除測試案例",
    method: "DELETE",
    path: "/autoTest/testList/scenario",
    errorCode: "0x106",
    needs: ["scenarioId"],
    // 收 id 陣列(也接受 { scenarioList: [...] })
    body: (p) => [p.scenarioId],
  },
  {
    no: 9,
    group: "測試項目",
    label: "新增測試項目",
    method: "POST",
    path: "/autoTest/testList/{scenarioId}/testcase",
    errorCode: "0x103",
    needs: ["scenarioId", "name"],
    // scenarioId 走路徑,body 是測項物件(單一或陣列皆可)
    body: (p) => [{ testcaseName: p.name, testcaseDescription: "" }],
  },
  {
    no: 11,
    group: "測試項目",
    label: "更新測試項目",
    method: "PUT",
    path: "/autoTest/testList/{scenarioId}/testcase",
    errorCode: "0x105",
    needs: ["scenarioId", "testcaseId", "name"],
    body: (p) => [{ testcaseId: p.testcaseId, testcaseName: p.name }],
  },
  {
    no: 13,
    group: "測試項目",
    label: "刪除測試項目",
    method: "DELETE",
    path: "/autoTest/testList/{scenarioId}/testcase",
    errorCode: "0x107",
    needs: ["scenarioId", "testcaseId"],
    body: (p) => [p.testcaseId],
  },
  {
    // 驅動以**案例**為單位 —— 其他團隊的共通性測試平台是整個案例送過來,
    // 不會單獨驅動一個測項,左螢幕的模擬器照這個行為模擬。adapter 的
    // /autoTest/test 本來就收 testcaseList 陣列,送整包不需要改 tester。
    no: 15,
    group: "驅動與查詢",
    label: "驅動測試(整個案例)",
    method: "POST",
    path: "/autoTest/test",
    errorCode: "0x110",
    needs: ["scenarioId"],
    body: (_p, ctx) => ({
      testcaseList: (ctx?.scenarioTestcaseIds ?? []).map((id) => ({ testcaseId: id })),
    }),
  },
  {
    no: 21,
    group: "驅動與查詢",
    label: "查詢測試狀態",
    method: "POST",
    path: "/autoTest/test/testStatus",
    errorCode: "0x108",
    needs: ["runningId"],
    body: (p) => [p.runningId],
  },
  {
    no: 23,
    group: "驅動與查詢",
    label: "查詢測試結果",
    method: "POST",
    path: "/autoTest/test/testResult",
    errorCode: "0x109",
    needs: ["runningId"],
    body: (p) => [p.runningId],
  },
  {
    no: 25,
    group: "其他",
    label: "更新待測物名稱",
    method: "PUT",
    path: "/autoTest/testList/rename",
    errorCode: "0x111",
    needs: ["dutName", "name"],
    // adapter 讀的是 oldDutName / newDutName
    body: (p) => ({ oldDutName: p.dutName, newDutName: p.name }),
  },
];

export type OpResult = {
  ok: boolean;
  status: number;
  ms: number;
  /** 顯示用:過長會截斷,**不要拿來解析** */
  text: string;
  /** 完整未截斷的回應,供解析(下拉選單的目錄就是從這裡來的) */
  full: string;
};

const MAX_PREVIEW = 1200;

/** 客戶端逾時 —— 目標主機不通時 nginx 要 60 秒才回 504,那會讓模擬器
 *  整整卡一分鐘。這裡先一步中止,快速給出可讀的失敗訊息。 */
const TIMEOUT_MS = 10_000;

/** 發送一支 adapter 操作,回傳狀態碼、耗時與回應內容。 */
export async function runAdapterOp(
  source: RicSourceId,
  op: AdapterOp,
  params: Record<string, string>,
  ctx?: OpContext,
): Promise<OpResult> {
  const path = op.path.replace(/\{(\w+)\}/g, (_, k: string) => params[k] ?? `{${k}}`);
  const url = ricSourceBase(source) + path;
  const body = op.body?.(params, ctx);
  const started = performance.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: op.method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const raw = await res.text();
    let text = raw;
    try {
      text = JSON.stringify(JSON.parse(raw), null, 2);
    } catch {
      /* 不是 JSON 就原樣顯示 */
    }
    return {
      ok: res.ok,
      status: res.status,
      ms: Math.round(performance.now() - started),
      text: text.length > MAX_PREVIEW ? text.slice(0, MAX_PREVIEW) + "\n…(已截斷)" : text,
      full: text,
    };
  } catch (e) {
    const aborted = e instanceof DOMException && e.name === "AbortError";
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      full: "",
      text: aborted
        ? `逾時(${TIMEOUT_MS / 1000} 秒未回應)\n\n${op.method} ${url}\n\n` +
          "多半是目標 tester 連不到。確認 deploy/.env 的 RIC_HOST 以及該主機是否可達。"
        : e instanceof Error
          ? e.message
          : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}
