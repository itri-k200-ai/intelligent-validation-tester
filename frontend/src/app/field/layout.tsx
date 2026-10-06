import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { FieldAuthGate } from "@/components/FieldTest/FieldAuthGate";

export const metadata: Metadata = {
  title: "智慧網路場域測試",
  description: "室內 AMR / 室外 UAV 場域測試的即時狀態與歷史回放",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A172F",
};

/**
 * 一般電腦 / 手機看的場域測試頁。
 *
 * 刻意放在 (dashboard) 之外:那一組的 AppShell 固定走電視牆模式(見 wallModeStore),
 * 會把整頁畫成 11520×6480 的牆面畫布再縮小,手機上根本看不到東西。
 */
export default function FieldLayout({ children }: { children: ReactNode }) {
  return <FieldAuthGate>{children}</FieldAuthGate>;
}
