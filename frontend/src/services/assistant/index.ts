import type { FieldRun, FieldVehicleStatus, LinkQuality } from "@/types/fieldTest";

import { API_BASE, apiClient } from "@/services/api/client";
import { useAuthStore } from "@/stores/authStore";
import { formatRate } from "@/lib/formatRate";

import { localReply } from "./localReply";

/** 小助理回答問題時看得到的東西 —— 都是頁面上已經顯示的資料 */
export type AssistantContext = {
  scenarioLabel: string;
  testName: string;
  environment: string;
  status: string;
  percent: number | null;
  stage?: string;
  link: LinkQuality | null;
  vehicle: FieldVehicleStatus;
  position: { x: number; y: number } | null;
  geo: { lat: number; lon: number } | null;
  runs: FieldRun[];
};

export type AssistantAnswer = {
  text: string;
  /** agent = 網管 agent 回的;local = agent 連不上,改用本地關鍵字回覆 */
  source: "agent" | "local";
  /** agent 建議的下一個問題(畫面拿來換掉下方的快捷問題) */
  suggestions?: string[];
};

type AskOptions = {
  signal?: AbortSignal;
  /** agent 逐字吐出時,目前累積的整段文字(畫面先顯示,讓人知道它在動) */
  onDelta?: (soFar: string) => void;
  /** agent 在呼叫工具時的提示(例如「正在查詢…」) */
  onStatus?: (text: string) => void;
};

/** agent 的對話 session —— 存在這個分頁,重整後還記得前文;關掉分頁就重新開始 */
const SESSION_KEY = "ivt-assistant-session";
const loadSession = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};
const saveSession = (id: string) => {
  try {
    sessionStorage.setItem(SESSION_KEY, id);
  } catch {
    /* 存不了就每次都開新的 session */
  }
};

/**
 * 小助理的「大腦」—— 畫面(FieldAssistant)只認這一支。
 *
 * 問題連同頁面上的即時資料送到我們後端的 /api/assistant/chat/,後端再轉給網管 agent
 * (Infrastructure Operator Co-pilot,見 backend/apps/assistant)。回覆是串流:逐字內容走 onDelta,
 * 最後回傳 agent 的最終答案。
 *
 * agent 連不上(或後端沒設定)時退回 localReply —— 對話框不能整個沒反應。
 */
export async function askAssistant(text: string, ctx: AssistantContext, opts: AskOptions = {}): Promise<AssistantAnswer> {
  try {
    const answer = await askAgent(text, ctx, opts);
    if (answer) return { ...answer, source: "agent" };
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
  }
  return { text: localReply(text, ctx), source: "local" };
}

async function askAgent(
  text: string,
  ctx: AssistantContext,
  opts: AskOptions,
): Promise<{ text: string; suggestions?: string[] } | null> {
  const body = JSON.stringify({ text, context: describeContext(ctx), sessionId: loadSession() });
  const post = () =>
    fetch(`${API_BASE}/assistant/chat/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        Authorization: `Bearer ${useAuthStore.getState().token ?? ""}`,
      },
      body,
      signal: opts.signal,
    });
  let res = await post();
  if (res.status === 401) {
    // token 過期:隨便打一支 API 讓 apiClient 的攔截器去換新的 token,再試一次
    await apiClient.get("/auth/me/").catch(() => undefined);
    res = await post();
  }
  if (!res.ok || !res.body) return null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let soFar = "";
  let final: { text: string; suggestions?: string[] } | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, cut);
      buf = buf.slice(cut + 2);
      let event = "message";
      let data = "";
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }
      if (!data) continue; // 心跳
      const payload = JSON.parse(data) as { text?: string; sessionId?: string; suggestions?: string[] };
      if (event === "session" && payload.sessionId) saveSession(payload.sessionId);
      // agent 會在答案最後加 <!--suggest: [...]-->(給它自己的介面用),逐字顯示時先藏起來
      else if (event === "delta" && payload.text) opts.onDelta?.((soFar += payload.text).replace(/<!--[\s\S]*$/, "").trimEnd());
      else if (event === "status" && payload.text) opts.onStatus?.(payload.text);
      else if (event === "final" && payload.text) final = { text: payload.text, suggestions: payload.suggestions };
      else if (event === "error") return null;
    }
  }
  if (final) return final;
  const partial = soFar.replace(/<!--[\s\S]*$/, "").trim();
  return partial ? { text: partial } : null;
}

/** 把頁面上的資料寫成幾行中文,讓 agent 讀得懂(它本身是網管用途,不認識場域測試) */
function describeContext(c: AssistantContext): string {
  const n = (v: number | null | undefined, d = 1) => (v == null ? "無資料" : v.toFixed(d));
  const r = (kbps: number | null | undefined) => {
    const f = formatRate(kbps ?? null);
    return f.value === null ? "無資料" : `${f.value} ${f.unit}`;
  };
  const mean = (phase: "before" | "after", key: "dlKbps" | "ulKbps") => {
    const vals = (c.runs.find((x) => x.phase === phase)?.samples ?? [])
      .map((s) => s[key])
      .filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const l = c.link;
  const v = c.vehicle;
  return [
    `情境:${c.scenarioLabel}(${c.scenarioLabel === "室外" ? "UAV 無人機" : "AMR 自走車"})`,
    `測試項目:${c.testName};測試環境:${c.environment}`,
    `驗測狀態:${c.status};測試進度:${c.percent == null ? "無資料" : `${c.percent}%`}${c.stage ? `(${c.stage})` : ""}`,
    l
      ? `通訊品質:SINR ${n(l.sinrDb)} dB、RSRP ${n(l.rsrpDbm)} dBm、RSRQ ${n(l.rsrqDb)} dB、RTT ${n(l.rttMs)} ms、下行 ${r(l.dlKbps)}、上行 ${r(l.ulKbps)}`
      : "通訊品質:無資料(載具可能離線)",
    `載具:電量 ${v.batteryPct ?? "無資料"}%、速度 ${n(v.speedMps)} m/s${v.altitudeM != null ? `、高度 ${n(v.altitudeM)} m` : ""}`,
    c.geo
      ? `位置:緯度 ${c.geo.lat.toFixed(5)}、經度 ${c.geo.lon.toFixed(5)}`
      : c.position
        ? `位置:x ${c.position.x.toFixed(1)} m、y ${c.position.y.toFixed(1)} m`
        : "位置:無資料",
    `啟用前後平均:上行 ${r(mean("before", "ulKbps"))} → ${r(mean("after", "ulKbps"))};下行 ${r(mean("before", "dlKbps"))} → ${r(mean("after", "dlKbps"))}`,
  ].join("\n");
}
