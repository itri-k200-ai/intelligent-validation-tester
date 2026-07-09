import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import type { ReactNode } from "react";

import { QueryProvider } from "@/providers/QueryProvider";
import "@/styles/globals.css";

const notoSansTC = Noto_Sans_TC({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-tc",
  display: "swap",
});

export const metadata: Metadata = {
  title: "智慧驗證 tester",
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
