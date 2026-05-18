"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import { API_BASE, fetcher, type Instance } from "@/lib/api";

type FilesResponse = {
  root?: string;
  note?: string;
  files: { path: string; size: number }[];
};

export default function InstancePage({ params }: { params: { id: string } }) {
  const { data: instance } = useSWR<Instance>(
    `/api/instances/${params.id}/`,
    fetcher
  );
  const { data: filesData } = useSWR<FilesResponse>(
    `/api/instances/${params.id}/files/`,
    fetcher
  );
  const [selected, setSelected] = useState<string | null>(null);
  const { data: preview } = useSWR(
    selected
      ? `/api/instances/${params.id}/files/${encodeURIComponent(selected)}`
      : null,
    async (path: string) => {
      const r = await fetch(`${API_BASE}${path}`);
      return r.text();
    }
  );

  if (!instance) return <div className="p-6 text-sm">載入中…</div>;

  return (
    <div className="flex h-screen">
      <aside className="w-72 border-r border-gray-200 bg-gray-50 flex flex-col">
        <div className="p-3 border-b border-gray-200">
          <Link href="/" className="text-xs text-blue-600 hover:underline">
            ← 回對話
          </Link>
          <h1 className="text-sm font-semibold mt-2">{instance.name}</h1>
          <div className="text-xs text-gray-500 mt-0.5">
            {instance.persona || "—"} · {instance.status}
          </div>
          <a
            href={`${API_BASE}/api/instances/${instance.id}/tarball`}
            className="block mt-3 text-center text-xs bg-blue-600 text-white rounded py-1.5"
          >
            下載 tar.gz
          </a>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-xs text-gray-500 px-1 pb-1">
            {filesData?.root || filesData?.note || "—"}
          </div>
          {filesData?.files.map((f) => (
            <button
              key={f.path}
              onClick={() => setSelected(f.path)}
              className={`block w-full text-left px-2 py-1 text-xs rounded ${
                selected === f.path
                  ? "bg-blue-100 text-blue-900"
                  : "hover:bg-gray-100"
              }`}
            >
              <div className="truncate">{f.path}</div>
              <div className="text-[10px] text-gray-500">{f.size} B</div>
            </button>
          ))}
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-4">
        {selected ? (
          <>
            <div className="text-xs text-gray-500 mb-2">{selected}</div>
            <pre className="text-xs bg-gray-900 text-gray-100 p-3 rounded overflow-auto">
              {preview ?? "載入中…"}
            </pre>
          </>
        ) : (
          <div className="text-sm text-gray-500">左側選一個檔案來預覽</div>
        )}
      </main>
    </div>
  );
}
