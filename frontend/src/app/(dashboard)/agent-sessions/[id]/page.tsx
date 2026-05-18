"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { use } from "react";

import { authDownload } from "@/lib/authDownload";
import { apiClient } from "@/services/api/client";

type Trace = {
  session: {
    id: string;
    title: string;
    mode?: string;
    status: string;
    summary?: string;
    dut_name?: string;
    started_at: string;
    ended_at?: string | null;
    cited_documents_detail?: Array<{
      id: string;
      doc_number: string;
      name: string;
      issuing_body: string;
      status: string;
    }>;
  };
  steps: Array<{
    seq: number;
    role: string;
    text: string;
    created_at: string;
    commands: Array<{
      command: string;
      stdout: string;
      stderr: string;
      exit_code: number | null;
      duration_ms: number | null;
    }>;
  }>;
  artifacts: Array<{
    id?: string;
    relpath: string;
    size_bytes: number | null;
    sha256?: string;
    content_type?: string;
    description?: string;
    download_url?: string;
  }>;
  case_results?: Array<{
    case_id: string;
    case_name: string;
    status: string;
    observed: string;
    notes: string;
    executed_at?: string | null;
    evidence_count: number;
  }>;
  evidence?: Array<{
    id?: string;
    kind: string;
    name: string;
    size_bytes: number | null;
    captured_with: string;
    description: string;
    result_id: string | null;
    download_url?: string;
  }>;
};

const TC_STATUS_COLOR: Record<string, string> = {
  pass: "bg-green-500/20 text-green-300",
  fail: "bg-red-500/20 text-red-300",
  blocked: "bg-yellow-500/20 text-yellow-300",
  skipped: "bg-gray-500/20 text-gray-300",
  error: "bg-red-500/30 text-red-200",
  in_progress: "bg-blue-500/20 text-blue-300",
};

const STATUS_COLOR: Record<string, string> = {
  completed: "bg-green-500/20 text-green-300 border-green-500/40",
  failed: "bg-red-500/20 text-red-300 border-red-500/40",
  in_progress: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  abandoned: "bg-gray-500/20 text-gray-300 border-gray-500/40",
};

export default function AgentSessionTracePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Trace | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get(`/agent-sessions/${id}/trace/`)
      .then((r) => setData(r.data))
      .catch((e) => setError(String(e?.response?.data?.detail ?? e?.message ?? e)));
  }, [id]);

  if (error) return <div className="text-danger">錯誤：{error}</div>;
  if (!data) return <div className="text-white/60">載入中…</div>;

  const s = data.session;
  return (
    <div className="space-y-6">
      <div>
        <Link href="/agent-sessions" className="text-xs text-white/60 hover:text-white">
          ← 回 Agent 紀錄
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{s.title}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm">
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-xs ${
              STATUS_COLOR[s.status] || "bg-white/10"
            }`}
          >
            {s.status}
          </span>
          {s.mode && <span className="text-white/70">mode: {s.mode}</span>}
          {s.dut_name && <span className="text-white/70">DUT: {s.dut_name}</span>}
          <span className="text-white/60 text-xs">
            {new Date(s.started_at).toLocaleString("zh-TW")}
            {s.ended_at && ` → ${new Date(s.ended_at).toLocaleString("zh-TW")}`}
          </span>
        </div>
      </div>

      {s.summary && (
        <div className="rounded-item border border-white/10 bg-white/5 p-4">
          <div className="text-xs uppercase text-white/50">驗測結論</div>
          <div className="mt-1 whitespace-pre-line text-sm">{s.summary}</div>
        </div>
      )}

      {s.cited_documents_detail && s.cited_documents_detail.length > 0 && (
        <div className="rounded-item border border-white/10 p-4">
          <div className="text-xs uppercase text-white/50 mb-2">引用文件</div>
          <ul className="space-y-1 text-sm">
            {s.cited_documents_detail.map((d) => (
              <li key={d.id}>
                <Link href={`/documents`} className="text-teal hover:underline">
                  [{d.issuing_body}] {d.doc_number}
                </Link>
                <span className="text-white/60"> — {d.name}</span>
                {d.status !== "active" && (
                  <span className="ml-2 text-yellow-300 text-xs">({d.status})</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* TestCase results — 第一公民、UI 直接列 */}
      {data.case_results && data.case_results.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">
            Test Case 結果 ({data.case_results.length})
          </h2>
          <div className="rounded-item border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-white/70">
                <tr>
                  <th className="px-3 py-2">Case</th>
                  <th className="px-3 py-2">狀態</th>
                  <th className="px-3 py-2">觀察</th>
                  <th className="px-3 py-2 text-right">證據</th>
                </tr>
              </thead>
              <tbody>
                {data.case_results.map((r, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono text-xs">
                      <div className="font-semibold">{r.case_id}</div>
                      <div className="text-white/60">{r.case_name}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        TC_STATUS_COLOR[r.status] || "bg-white/10"
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.observed || "—"}</td>
                    <td className="px-3 py-2 text-right text-xs">{r.evidence_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Evidence — pcap / log / screenshot */}
      {data.evidence && data.evidence.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-2">
            驗測證據 ({data.evidence.length})
          </h2>
          <div className="rounded-item border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-white/70">
                <tr>
                  <th className="px-3 py-2">類型</th>
                  <th className="px-3 py-2">名稱</th>
                  <th className="px-3 py-2">擷取工具</th>
                  <th className="px-3 py-2 text-right">大小</th>
                  <th className="px-3 py-2">說明</th>
                  <th className="px-3 py-2">下載</th>
                </tr>
              </thead>
              <tbody>
                {data.evidence.map((e, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 text-xs uppercase">{e.kind}</td>
                    <td className="px-3 py-2 text-xs font-mono">{e.name}</td>
                    <td className="px-3 py-2 text-xs">{e.captured_with || "—"}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {e.size_bytes ? `${(e.size_bytes / 1024).toFixed(1)} KB` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{e.description}</td>
                    <td className="px-3 py-2 text-xs">
                      {e.download_url && (
                        <button
                          onClick={() => authDownload(e.download_url!, e.name)}
                          className="text-teal hover:underline"
                        >↓ 下載</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-2">產出 Artifact ({data.artifacts.length})</h2>
        {data.artifacts.length === 0 ? (
          <div className="text-white/40 text-sm">（這場沒留 artifact）</div>
        ) : (
          <div className="rounded-item border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/5 text-left text-xs text-white/70">
                <tr>
                  <th className="px-3 py-2">路徑</th>
                  <th className="px-3 py-2">類型</th>
                  <th className="px-3 py-2 text-right">大小</th>
                  <th className="px-3 py-2">說明</th>
                  <th className="px-3 py-2">下載</th>
                </tr>
              </thead>
              <tbody>
                {data.artifacts.map((a) => (
                  <tr key={a.relpath} className="border-t border-white/5">
                    <td className="px-3 py-2 font-mono text-xs">{a.relpath}</td>
                    <td className="px-3 py-2 text-xs text-white/60">{a.content_type}</td>
                    <td className="px-3 py-2 text-right text-xs">
                      {a.size_bytes ? `${(a.size_bytes / 1024).toFixed(1)} KB` : "—"}
                    </td>
                    <td className="px-3 py-2 text-xs">{a.description}</td>
                    <td className="px-3 py-2 text-xs">
                      {a.download_url && (
                        <button
                          onClick={() => authDownload(a.download_url!, a.relpath.split("/").pop())}
                          className="text-teal hover:underline"
                        >↓ 下載</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">對話 + 指令 timeline ({data.steps.length} 步)</h2>
        {data.steps.length === 0 ? (
          <div className="text-white/40 text-sm">（沒記錄到任何 step）</div>
        ) : (
          <div className="space-y-3">
            {data.steps.map((step) => (
              <div key={step.seq} className="rounded-item border border-white/10 p-3">
                <div className="flex items-center justify-between text-xs text-white/60">
                  <span>
                    #{step.seq} · {step.role === "assistant" ? "🤖 Agent" : "👤 使用者"}
                  </span>
                  <span>{new Date(step.created_at).toLocaleTimeString("zh-TW")}</span>
                </div>
                <div className="mt-2 whitespace-pre-line text-sm">{step.text}</div>
                {step.commands.length > 0 && (
                  <div className="mt-2 space-y-1">
                    <div className="text-xs uppercase text-white/50">
                      跑了 {step.commands.length} 條指令：
                    </div>
                    {step.commands.map((c, i) => (
                      <div
                        key={i}
                        className="rounded-item bg-black/40 p-2 font-mono text-xs"
                      >
                        <div className="text-teal">$ {c.command}</div>
                        {c.stdout && (
                          <pre className="mt-1 whitespace-pre-wrap text-white/70">
                            {c.stdout.slice(0, 500)}
                            {c.stdout.length > 500 && "…"}
                          </pre>
                        )}
                        {c.stderr && (
                          <pre className="mt-1 whitespace-pre-wrap text-red-300">
                            {c.stderr.slice(0, 500)}
                            {c.stderr.length > 500 && "…"}
                          </pre>
                        )}
                        <div className="mt-1 text-white/40">
                          exit={c.exit_code ?? "?"} · {c.duration_ms ?? "?"}ms
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
