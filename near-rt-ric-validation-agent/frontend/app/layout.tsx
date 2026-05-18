import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AuthGate from "@/components/AuthGate";
import { LangProvider } from "@/lib/LangContext";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Browser-tab metadata. Edited by `init.sh` (or by hand). For per-page
// titles use Next's `generateMetadata` inside each route.
export const metadata: Metadata = {
  title: "Near-RT RIC Validation Agent",
  description: "Validates and tests Near-RT RIC systems.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-white text-zinc-900 antialiased">
        <LangProvider>
          <AuthGate>{children}</AuthGate>
        </LangProvider>
      </body>
    </html>
  );
}
