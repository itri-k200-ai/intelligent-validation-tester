"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiClient } from "@/services/api/client";

type Session = {
  id: string;
  title: string;
  mode?: string;
  status: string;
  summary?: string;
  dut_name?: string;
  started_at: string;
  ended_at?: string | null;
  step_count?: number;
  command_count?: number;
  artifact_count?: number;
};

const STATUS_SYM: Record<string, string> = {
  completed: "✅",
  failed: "❌",
  in_progress: "⏳",
  abandoned: "⏹️",
};
const STATUS_COLOR: Record<string, string> = {
  completed: "bg-green-500/20 text-green-300",
  failed: "bg-red-500/20 text-red-300",
  in_progress: "bg-blue-500/20 text-blue-300",
  abandoned: "bg-gray-500/20 text-gray-300",
};
const MODE_LABEL: Record<string, string> = {
  functional: "功能",
  conformance: "一致性",
  iot: "互通性",
  performance: "效能",
  resilience: "韌性",
  explore: "探索",
};

export default function AgentSessionsPage() {
  const [items, setItems] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get("/agent-sessions/")
      .then((r) => setItems(r.data.items ?? r.data.results ?? r.data ?? []))
      .catch((e) => setError(String(e?.response?.data?.detail ?? e?.message ?? e)))
      .finally(() => setLoading(false));
  }, []);

  const passCount = items.filter((s) => s.status === "completed").length;
  const failCount = items.filter((s) => s.status === "failed").length;
  const runningCount = items.filter((s) => s.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Agent 驗測紀錄</h1>
        <p className="text-sm text-white/60">
          Near-RT RIC Validation Agent 跑過的所有 session — 每場含結論、指令紀錄、產出 artifact
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-item border border-white/10 p-3">
          <div className="text-xs text-white/60">總場數</div>
          <div className="text-2xl font-semibold">{items.length}</div>
        </div>
        <div className="rounded-item border border-green-500/30 bg-green-500/5 p-3">
          <div className="text-xs text-green-300">PASS（completed）</div>
          <div className="text-2xl font-semibold text-green-300">{passCount}</div>
        </div>
        <div className="rounded-item border border-red-500/30 bg-red-500/5 p-3">
          <div className="text-xs text-red-300">FAIL</div>
          <div className="text-2xl font-semibold text-red-300">{failCount}</div>
        </div>
        <div className="rounded-item border border-blue-500/30 bg-blue-500/5 p-3">
          <div className="text-xs text-blue-300">進行中</div>
          <div className="text-2xl font-semibold text-blue-300">{runningCount}</div>
        </div>
      </div>

      {loading && <div className="text-white/60">載入中…</div>}
      {error && <div className="text-danger">錯誤：{error}</div>}

      {!loading && !error && (
        <div className="rounded-item border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs text-white/70">
              <tr>
                <th className="px-3 py-2">狀態</th>
                <th className="px-3 py-2">模式</th>
                <th className="px-3 py-2">標題</th>
                <th className="px-3 py-2">DUT</th>
                <th className="px-3 py-2 text-right">步驟</th>
                <th className="px-3 py-2 text-right">指令</th>
                <th className="px-3 py-2 text-right">產出</th>
                <th className="px-3 py-2">開始時間</th>
                <th className="px-3 py-2">action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id} className="border-t border-white/5 hover:bg-white/5 align-top">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        STATUS_COLOR[s.status] || "bg-white/10"
                      }`}
                    >
                      {STATUS_SYM[s.status] ?? "·"} {s.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-white/70">
                    {s.mode ? MODE_LABEL[s.mode] || s.mode : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{s.title}</div>
                    {s.summary && (
                      <div className="mt-0.5 text-xs text-white/60 line-clamp-2">{s.summary}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{s.dut_name || "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{s.step_count ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{s.command_count ?? "—"}</td>
                  <td className="px-3 py-2 text-right text-xs">{s.artifact_count ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-white/70">
                    {new Date(s.started_at).toLocaleString("zh-TW")}
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/agent-sessions/${s.id}`}
                      className="text-teal hover:underline text-xs"
                    >
                      回朔 →
                    </Link>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-white/40">
                    （Agent 還沒寫回任何 session）
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
