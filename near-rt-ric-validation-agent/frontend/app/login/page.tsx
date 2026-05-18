"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import AppHeader from "@/components/AppHeader";
import { API_BASE } from "@/lib/api";
import { useLang } from "@/lib/LangContext";
import { pick, useAppConfig } from "@/lib/useAppConfig";

export default function LoginPage() {
  const { t, lang } = useLang();
  const config = useAppConfig();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError(t("auth.error"));
        return;
      }
      router.replace("/");
    } catch {
      setError(t("auth.error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <div className="flex-1 flex items-center justify-center bg-gradient-to-b from-zinc-50 to-white">
        <form
          onSubmit={submit}
          className="w-[360px] max-w-[92vw] bg-white rounded-xl border border-zinc-200 p-7 shadow-sm"
        >
          <h1 className="text-[20px] font-semibold tracking-tight text-zinc-900">
            {t("auth.title")}
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1 leading-relaxed">
            {t("auth.subtitle")}
          </p>

          <label className="block mt-5">
            <span className="text-[11px] uppercase tracking-widest text-zinc-500 font-medium">
              {t("auth.password")}
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="mt-1.5 w-full border border-zinc-200 rounded-md px-3 py-2 text-[14px] focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
            />
          </label>

          {error && (
            <div className="mt-3 text-[13px] text-red-600">{error}</div>
          )}

          <button
            type="submit"
            disabled={submitting || !password}
            className="mt-5 w-full h-10 bg-zinc-900 text-white rounded-md text-[14px] font-medium hover:bg-zinc-700 disabled:bg-zinc-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "…" : t("auth.submit")}
          </button>

          <div className="mt-6 text-[11px] text-zinc-400 text-center">
            {pick(config.app.name, lang)}
          </div>
        </form>
      </div>
    </div>
  );
}
