import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import type { ReactNode } from "react";

import { WALL_REGION } from "@/config/wallRegion";
import { QueryProvider } from "@/providers/QueryProvider";
import "@/styles/globals.css";

// 分頁標題標出這個 build 是哪一面牆,方便同時開三個分頁時分辨。
const REGION_SUFFIX: Record<string, string> = {
  all: "",
  center: "（中牆）",
  right: "（右翼）",
};

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: `智慧驗證 tester${REGION_SUFFIX[WALL_REGION] ?? ""}`,
  description: "O-RAN 資料與 AI 效能驗證儀表板",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-Hant" className={notoSansTC.variable}>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
