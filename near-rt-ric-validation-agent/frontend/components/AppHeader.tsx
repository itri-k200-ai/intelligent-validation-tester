"use client";

import Link from "next/link";
import LangToggle from "@/components/LangToggle";
import { useLang } from "@/lib/LangContext";
import { pick, useAppConfig } from "@/lib/useAppConfig";

/**
 * Top-of-page header used by the standalone routes (login, knowledge,
 * growth). Renders the app name from `domain/config.json` + an optional
 * sub-label + a language toggle + an optional back link.
 *
 * The main `/` chat page does NOT use this component — its header is
 * inside the Sidebar.
 *
 * To put a logo image here, drop one in `frontend/public/logo.png` and
 * uncomment the `<img>` line below.
 */
export default function AppHeader({
  subLabel,
  backHref,
  backLabel,
}: {
  subLabel?: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { lang } = useLang();
  const config = useAppConfig();
  const appName = pick(config.app.name, lang);
  return (
    <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b border-zinc-200">
      <div className="max-w-5xl mx-auto px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* <img src="/logo.png" alt={appName} className="h-9 w-auto shrink-0" /> */}
          <span className="text-[15px] font-semibold tracking-tight text-zinc-900 truncate">
            {appName}
          </span>
          {subLabel && (
            <>
              <span className="text-zinc-300">/</span>
              <span className="text-[14px] font-medium text-zinc-700 truncate">
                {subLabel}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <LangToggle />
          {backHref && (
            <Link
              href={backHref}
              className="text-[13px] text-zinc-600 hover:text-zinc-900 transition-colors"
            >
              {backLabel || "←"}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
