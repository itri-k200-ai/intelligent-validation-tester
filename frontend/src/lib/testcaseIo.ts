// ── 測試案例「輸入 / 輸出」對照表 ────────────────────────────────────
//
// ⚠ 來源:RICtester front_end 測試案例頁(/dashboard/testcases/<uuid>)。
//   這份內容在 RICtester 那邊是**寫死在前端**的,不在任何 API 或資料表裡
//   —— back_end 的 registry/testcases 只有 procedure / pass_criteria /
//   interface / spec_ref 等欄位,沒有請求與回應的細節。為了讓中牆畫出跟
//   RICtester 一模一樣的時序圖,只能把這張表原樣移植過來。
//
//   同步方式:RICtester 若新增測項或改了這張表,這裡要跟著補。要重新對
//   照時,抓它的測試案例頁 chunk 搜 `match:/` 即可看到原始定義。
//
// 比對對象是 testcase_procedure(例:"Query All Policy Types"),由上而下
// 取第一個命中的;都沒命中就用 fallback 的通用格式(見 resolveTestcaseIo)。

export type TestcaseIoFields = {
  /** 測試端送出的內容(圖上「輸入 / 送出」欄)。 */
  request: string[];
  /** 預期收到的回應(圖上「輸出 / 預期回應」欄)。 */
  response: string[];
};

type IoRule = { match: RegExp } & TestcaseIoFields;

const IO_TABLE: IoRule[] = [
  {
    match: /e2 setup/i,
    request: [
      "transactionID",
      "Global E2 Node ID (PLMN, gNB-ID)",
      "RAN Functions List",
      "E2 Node Component Config",
    ],
    response: [
      "transactionID",
      "Global RIC ID",
      "RAN Functions Accepted",
      "RAN Functions Rejected",
    ],
  },
  {
    match: /subscription delete/i,
    request: [
      "RIC Request ID (Requestor, Instance)",
      "RAN Function ID",
    ],
    response: [
      "RIC Request ID",
      "RAN Function ID",
    ],
  },
  {
    match: /subscription/i,
    request: [
      "RIC Request ID (Requestor, Instance)",
      "RAN Function ID",
      "RIC Subscription Details",
      "└ Event Trigger Definition",
      "└ Sequence of Actions (Action List)",
    ],
    response: [
      "RIC Request ID",
      "RAN Function ID",
      "RIC Actions Admitted List",
      "RIC Actions Not Admitted (cause)",
    ],
  },
  {
    match: /control/i,
    request: [
      "RIC Request ID",
      "RAN Function ID",
      "RIC Control Header",
      "RIC Control Message",
      "RIC Control Ack Request",
    ],
    response: [
      "RIC Request ID",
      "RAN Function ID",
      "RIC Control Outcome (Acknowledge)",
    ],
  },
  {
    match: /reset/i,
    request: [
      "transactionID",
      "Cause",
    ],
    response: ["transactionID"],
  },
  {
    match: /error indication/i,
    request: [
      "RIC Request ID",
      "RAN Function ID",
      "Cause",
      "Criticality Diagnostics",
    ],
    response: ["(無回應 — 僅指示 indication)"],
  },
  {
    match: /service update/i,
    request: [
      "transactionID",
      "RAN Functions Added",
      "RAN Functions Modified",
      "RAN Functions Deleted",
    ],
    response: [
      "transactionID",
      "RAN Functions Accepted",
      "RAN Functions Rejected",
    ],
  },
  {
    match: /service query/i,
    request: [
      "transactionID",
      "RAN Functions Accepted List",
    ],
    response: [
      "transactionID",
      "RAN Functions Added/Modified/Deleted",
    ],
  },
  {
    match: /node.*config/i,
    request: [
      "transactionID",
      "E2 Node Component Config Addition",
      "E2 Node Component Config Update",
    ],
    response: [
      "transactionID",
      "E2 Node Component Config Ack",
    ],
  },
  {
    match: /mediator health/i,
    request: ["GET /A1-P/v2/healthcheck"],
    response: ["HTTP 200 OK"],
  },
  {
    match: /query all policy types|query policy types/i,
    request: ["GET /A1-P/v2/policytypes"],
    response: [
      "HTTP 200",
      "[ policy_type_id, … ]",
    ],
  },
  {
    match: /create policy type/i,
    request: [
      "PUT /A1-P/v2/policytypes/{id}",
      "body: { name, policy_type_id, create_schema }",
    ],
    response: ["HTTP 201 Created"],
  },
  {
    match: /delete policy type/i,
    request: ["DELETE /A1-P/v2/policytypes/{id}"],
    response: ["HTTP 204 No Content"],
  },
  {
    match: /create.*policy|single policy/i,
    request: [
      "PUT /A1-P/v2/policytypes/{id}/policies/{pid}",
      "body: { scope, statement }",
    ],
    response: ["HTTP 201 / 202 Accepted"],
  },
  {
    match: /policy status|policy.*status/i,
    request: [
      "GET /A1-P/v2/policytypes/{id}/policies/{pid}/status",
    ],
    response: [
      "HTTP 200",
      "{ enforceStatus, enforceReason }",
    ],
  },
  {
    match: /delete.*policy|delete single policy/i,
    request: [
      "DELETE /A1-P/v2/policytypes/{id}/policies/{pid}",
    ],
    response: ["HTTP 204 No Content"],
  },
  {
    match: /ei type/i,
    request: ["GET /A1-EI/v1/eitypes"],
    response: [
      "HTTP 200",
      "[ eiTypeId, … ]",
    ],
  },
  {
    match: /ei job/i,
    request: [
      "PUT/GET/DELETE /A1-EI/v1/eijobs/{id}",
      "body: { eiTypeId, jobDefinition, targetUri }",
    ],
    response: ["HTTP 200 / 201"],
  },
  {
    match: /o1 login|login/i,
    request: [
      "NETCONF <hello> over SSH (830)",
      "user / password",
    ],
    response: ["<hello> capabilities, session-id"],
  },
  {
    match: /alarm/i,
    request: ["<get> / <get-config> (alarm subtree)"],
    response: ["<data> alarm-list { alarm-id, severity, … }"],
  },
  {
    match: /edit|config/i,
    request: ["<edit-config> <config> … </config>"],
    response: ["<ok/>"],
  },
];

/**
 * 依 procedure 找出請求 / 回應內容。找不到就退回通用格式,協定字首依介面
 * 決定 —— 與 RICtester 的 fallback 規則相同,確保兩邊畫出來一致。
 */
export function resolveTestcaseIo(
  procedure: string,
  interfaceName?: string | null,
): TestcaseIoFields {
  const proc = procedure || "Procedure";
  const hit = IO_TABLE.find((rule) => rule.match.test(proc));
  if (hit) return { request: hit.request, response: hit.response };

  const iface = (interfaceName ?? "").toLowerCase();
  const proto = iface === "a1" || iface === "r1" ? "HTTP" : iface === "o1" ? "NETCONF" : "E2AP";
  return {
    request: [`${proto} ${proc} Request`],
    response: [`${proto} ${proc} Response`],
  };
}

/**
 * 介面配色。RICtester 用的是淺色主題的色票(a1 #1a7f37 等),牆面是深色,
 * 直接沿用會太暗 —— 這裡換成專案 palette 裡對應的同色系亮色。
 */
export function testcaseIoAccent(interfaceName?: string | null): string {
  switch ((interfaceName ?? "").toLowerCase()) {
    case "a1":
      return "#80FFE8"; // primary green
    case "o1":
      return "#FFC56B"; // warning
    case "y1":
      return "#B490FF"; // xapp purple
    default:
      return "#72B6C9"; // teal(e2 / 其餘)
  }
}
