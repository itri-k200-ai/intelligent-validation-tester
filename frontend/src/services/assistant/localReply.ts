import { formatRate } from "@/lib/formatRate";
import type { FieldRun } from "@/types/fieldTest";

import type { AssistantContext } from "./index";

// 本地的暫代回覆:依關鍵字拿頁面上的即時資料組句子。
// 接上 agent 之後仍保留,當 agent 連不上時的備援(見 askAssistant)。

const num = (v: number | null | undefined, d = 1) => (v == null ? "—" : v.toFixed(d));

function mean(runs: FieldRun[], phase: "before" | "after", key: "dlKbps" | "ulKbps") {
  const vals = (runs.find((r) => r.phase === phase)?.samples ?? [])
    .map((s) => s[key])
    .filter((v): v is number => typeof v === "number");
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function rate(kbps: number | null) {
  const r = formatRate(kbps);
  return r.value === null ? "—" : `${r.value} ${r.unit}`;
}

/** 依關鍵字回答。順序有意義:比較明確的放前面(例如「上行」要先於「速度」) */
export function localReply(text: string, c: AssistantContext): string {
  const q = text.toLowerCase();
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("你好", "嗨", "哈囉", "hello", "hi"))
    return `你好!目前畫面是${c.scenarioLabel}的「${c.testName}」,狀態是${c.status}。想知道什麼呢?`;

  if (has("能做什麼", "可以問", "幫助", "help", "功能"))
    return "可以問我:\n・目前進度 / 階段\n・驗測狀態\n・通訊品質(SINR、RSRP、RSRQ、RTT)\n・啟用前後的上行、下行比較\n・載具的電量、速度、位置\n・測試項目與環境";

  if (has("報告"))
    return "請點頁面上方的「驗測報告」按鈕,會顯示這一次驗測的 PDF 報告,也可以下載。";

  if (has("比較", "啟用前", "啟用後", "上行", "下行", "吞吐", "throughput", "平均")) {
    const b = { ul: mean(c.runs, "before", "ulKbps"), dl: mean(c.runs, "before", "dlKbps") };
    const a = { ul: mean(c.runs, "after", "ulKbps"), dl: mean(c.runs, "after", "dlKbps") };
    if (b.ul === null && b.dl === null) return "這一次驗測還沒有吞吐量的資料。";
    if (a.ul === null && a.dl === null)
      return `第一趟(啟用前)平均上行 ${rate(b.ul)}、下行 ${rate(b.dl)}。第二趟(啟用後)還沒有資料,跑完才能比較。`;
    return `平均上行:啟用前 ${rate(b.ul)} → 啟用後 ${rate(a.ul)}\n平均下行:啟用前 ${rate(b.dl)} → 啟用後 ${rate(a.dl)}`;
  }

  if (has("進度", "跑到", "階段", "完成", "多少%"))
    return c.percent === null
      ? "目前還沒有進度資料。"
      : `${c.scenarioLabel}「${c.testName}」的測試進度是 ${c.percent}%${c.stage ? `,目前在「${c.stage}」` : ""}。`;

  if (has("狀態", "在跑", "執行", "結束", "回放"))
    return `目前狀態:${c.status}。${c.status === "歷史回放" ? "畫面正在重播指定的歷史紀錄。" : ""}`;

  if (has("訊號", "通訊", "品質", "sinr", "rsrp", "rsrq", "rtt", "延遲")) {
    const l = c.link;
    if (!l) return "目前拿不到通訊品質的資料(載具可能離線)。";
    return `通訊品質:\nSINR ${num(l.sinrDb)} dB、RSRP ${num(l.rsrpDbm)} dBm、RSRQ ${num(l.rsrqDb)} dB\nRTT ${num(l.rttMs)} ms、下行 ${rate(l.dlKbps ?? null)}、上行 ${rate(l.ulKbps ?? null)}`;
  }

  if (has("電量", "電池", "battery"))
    return c.vehicle.batteryPct == null
      ? "目前拿不到電量(載具可能離線)。"
      : `載具電量 ${c.vehicle.batteryPct}%${c.vehicle.batteryPct < 30 ? ",偏低了。" : "。"}`;

  if (has("位置", "在哪", "座標", "經緯度")) {
    if (c.geo) return `UAV 目前位置:緯度 ${c.geo.lat.toFixed(5)}、經度 ${c.geo.lon.toFixed(5)}。`;
    if (c.position) return `AMR 目前位置:x ${c.position.x.toFixed(1)} m、y ${c.position.y.toFixed(1)} m。`;
    return "目前拿不到載具位置(載具可能離線)。";
  }

  if (has("速度", "多快", "高度"))
    return `速度 ${num(c.vehicle.speedMps)} m/s${c.vehicle.altitudeM != null ? `、高度 ${num(c.vehicle.altitudeM)} m` : ""}。`;

  if (has("項目", "環境", "測什麼", "測試什麼", "哪裡"))
    return `這次是${c.scenarioLabel}的「${c.testName}」,地點在${c.environment}。`;

  return "這個問題我還答不了。目前可以問進度、狀態、通訊品質、啟用前後比較、電量、位置,或測試項目與環境。";
}
