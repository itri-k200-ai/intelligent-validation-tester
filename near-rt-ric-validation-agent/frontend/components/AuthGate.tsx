"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API_BASE } from "@/lib/api";

type State = "checking" | "ok" | "redirecting";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          credentials: "same-origin",
        });
        if (cancelled) return;
        if (res.ok) {
          // Authenticated (or auth disabled). If on /login, bounce home.
          setState("ok");
          if (pathname === "/login") router.replace("/");
        } else {
          // Not authed. Allow /login page; redirect everything else.
          if (pathname === "/login") {
            setState("ok");
          } else {
            setState("redirecting");
            router.replace("/login");
          }
        }
      } catch {
        if (!cancelled) setState("ok"); // fail-open if backend unreachable
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (state === "checking" || state === "redirecting") {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-400 text-[13px]">
        ...
      </div>
    );
  }
  return <>{children}</>;
}
