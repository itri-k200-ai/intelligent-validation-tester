"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/Auth/useAuth";

/**
 * 不必等登入完才畫的頁面:電視牆的室內 / 室外情境。它們要的資料全是唯讀端點
 * (apps/field_tests 的 WallReadView、selection 都是 AllowAny),登入在背景跑就好。
 * 以前要先等自動登入(實測 0.6~1.3 秒)整頁才開始抓資料,牆面開頁就慢這一段。
 * 其他頁面有要登入才能打的 API,維持原樣 —— token 還沒到就打會 401,
 * 401 處理會整頁重新載入(見 services/api/client)。
 */
const NO_WAIT_FOR_LOGIN = ["/indoor-scenario", "/outdoor-scenario"];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth({ requireAuth: true });
  const pathname = usePathname() ?? "";
  const noWait = NO_WAIT_FOR_LOGIN.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isAuthenticated && !noWait) return null;
  return <AppShell>{children}</AppShell>;
}
