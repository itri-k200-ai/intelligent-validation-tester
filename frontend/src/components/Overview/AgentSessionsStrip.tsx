"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { apiClient } from "@/services/api/client";

type Stat = { total: number; pass: number; fail: number; in_progress: number; failed: number };

export function AgentSessionsStrip() {
  const [s, setS] = useState<Stat | null>(null);

  useEffect(() => {
    apiClient.get("/agent-sessions/").then((r) => {
      const items = r.data.items ?? r.data.results ?? [];
      setS({
        total: items.length,
        pass: items.filter((x: any) => x.status === "completed").length,
        fail: items.filter((x: any) => x.status === "failed").length,
        failed: items.filter((x: any) => x.status === "failed").length,
        in_progress: items.filter((x: any) => x.status === "in_progress").length,
      });
    }).catch(() => {});
  }, []);

  if (!s) return null;

  return (
    <Link
      href="/agent-sessions"
      className="block rounded-item border border-white/10 p-3 hover:border-teal/40 transition"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Agent 驗測 (Near-RT RIC)</div>
        <div className="text-xs text-white/60">→ 詳情</div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <Cell label="總場數" value={s.total} />
        <Cell label="PASS" value={s.pass} tone="green" />
        <Cell label="FAIL" value={s.fail} tone="red" />
        <Cell label="進行中" value={s.in_progress} tone="blue" />
      </div>
    </Link>
  );
}

function Cell({ label, value, tone }: { label: string; value: number; tone?: "green" | "red" | "blue" }) {
  const color = tone === "green" ? "text-green-300"
    : tone === "red" ? "text-red-300"
    : tone === "blue" ? "text-blue-300"
    : "text-white";
  return (
    <div>
      <div className="text-xs text-white/60">{label}</div>
      <div className={`text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
