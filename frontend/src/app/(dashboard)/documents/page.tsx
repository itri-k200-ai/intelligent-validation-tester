"use client";

import { useEffect, useState } from "react";

import { authDownload } from "@/lib/authDownload";
import { apiClient } from "@/services/api/client";

type Doc = {
  id: string;
  name: string;
  doc_type: string;
  issuing_body?: string;
  doc_number?: string;
  version?: string;
  status?: string;
  publication_date?: string | null;
  source_url?: string;
  size_bytes?: number | null;
  description?: string;
  download_url?: string;
};

const STATUS_COLOR: Record<string, string> = {
  active: "bg-green-500/20 text-green-300",
  superseded: "bg-yellow-500/20 text-yellow-300",
  obsolete: "bg-red-500/20 text-red-300",
  draft: "bg-blue-500/20 text-blue-300",
  withdrawn: "bg-gray-500/20 text-gray-300",
};

function fmtKB(b?: number | null) {
  return b ? `${(b / 1024).toFixed(0)} KB` : "—";
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterBody, setFilterBody] = useState<string>("");

  useEffect(() => {
    setLoading(true);
    apiClient
      .get("/documents/", { params: filterBody ? { issuing_body: filterBody } : {} })
      .then((r) => setDocs(r.data.items ?? r.data.results ?? r.data ?? []))
      .catch((e) => setError(String(e?.response?.data?.detail ?? e?.message ?? e)))
      .finally(() => setLoading(false));
  }, [filterBody]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">規格文件</h1>
          <p className="text-sm text-white/60">驗測案例引用來源 — 國際標準 / 內部文件 / 設備規格</p>
        </div>
        <select
          className="h-9 rounded-item border border-white/20 bg-navy-400 text-white px-3 text-sm"
          value={filterBody}
          onChange={(e) => setFilterBody(e.target.value)}
        >
          <option value="">全部單位</option>
          <option value="IETF">IETF</option>
          <option value="3GPP">3GPP</option>
          <option value="ITU-T">ITU-T</option>
          <option value="O-RAN">O-RAN Alliance</option>
          <option value="ETSI">ETSI</option>
        </select>
      </div>

      {loading && <div className="text-white/60">載入中…</div>}
      {error && <div className="text-danger">錯誤：{error}</div>}

      {!loading && !error && (
        <div className="rounded-item border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-xs text-white/70">
              <tr>
                <th className="px-3 py-2">發行單位</th>
                <th className="px-3 py-2">編號</th>
                <th className="px-3 py-2">版本</th>
                <th className="px-3 py-2">狀態</th>
                <th className="px-3 py-2">名稱</th>
                <th className="px-3 py-2 text-right">大小</th>
                <th className="px-3 py-2">下載</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className="border-t border-white/5 hover:bg-white/5">
                  <td className="px-3 py-2 font-mono text-xs">{d.issuing_body || "—"}</td>
                  <td className="px-3 py-2 font-mono">{d.doc_number || "—"}</td>
                  <td className="px-3 py-2 text-xs">{d.version || "—"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                        STATUS_COLOR[d.status || "active"] || "bg-white/10"
                      }`}
                    >
                      {d.status || "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2">{d.name}</td>
                  <td className="px-3 py-2 text-right text-xs text-white/70">{fmtKB(d.size_bytes)}</td>
                  <td className="px-3 py-2">
                    {d.download_url && (
                      <button
                        onClick={() => authDownload(d.download_url!,
                          `${d.doc_number || d.name}${d.version ? "-" + d.version : ""}`)}
                        className="text-teal hover:underline text-xs"
                      >
                        ↓ 下載
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {docs.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-white/40">
                    （沒有資料）
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-white/50">
        共 {docs.length} 份。Agent 引規格時會帶上 ↑ 下載連結作為證據。
      </div>
    </div>
  );
}
