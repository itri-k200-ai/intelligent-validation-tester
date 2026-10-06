"use client";
import type { ReactNode } from "react";

import { useAuth } from "@/hooks/Auth/useAuth";

/** 跟 (dashboard) 一樣背後自動登入;拿到 token 前只顯示一行字,不要閃出空白版面 */
export function FieldAuthGate({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth({ requireAuth: true });
  if (!isAuthenticated) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-white/50">載入中…</div>;
  }
  return <main className="min-h-screen px-3 py-4 sm:px-4 md:px-6 md:py-6">{children}</main>;
}
