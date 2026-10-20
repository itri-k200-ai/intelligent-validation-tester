"use client";
import type { ReactNode } from "react";

import { useAuth } from "@/hooks/Auth/useAuth";

/**
 * 跟 (dashboard) 一樣背後自動登入,但**不等登入完才畫頁面**。
 *
 * /field 要看的資料(驗測、遙測、影像)全是唯讀端點,後端本來就不必登入
 * (apps/field_tests 的 WallReadView);只有「開始驗測」要 token,登入在背景跑,
 * 一般 1 秒內就好,遠早於有人按得到那顆鈕。
 * 以前拿到 token 前整頁只顯示「載入中…」,所有請求與影像都晚一個登入往返才開始
 * (院外網路慢時 1 秒以上),影像要 3~4 秒才出來。
 */
export function FieldAuthGate({ children }: { children: ReactNode }) {
  useAuth({ requireAuth: true });
  return <main className="min-h-screen px-3 py-4 sm:px-4 md:px-6 md:py-6">{children}</main>;
}
