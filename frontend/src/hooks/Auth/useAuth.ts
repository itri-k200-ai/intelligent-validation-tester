"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { AUTO_LOGIN_CREDENTIALS, LOGIN_ENABLED } from "@/config/auth";
import { authService } from "@/services";
import { apiClient } from "@/services/api/client";
import { useAuthStore } from "@/stores/authStore";

// 模組層級旗標,避免多個 useAuth 實例同時觸發自動登入(login 只打一次)。
let autoLoginInFlight = false;

export function useAuth(options: { requireAuth?: boolean } = {}) {
  // 用 selector 拿 stable reference，避免每次 render setUser 都新 identity
  // 觸發 useEffect 無限重跑 → /auth/me 連環 401 → 一直被登出。
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const setAuth = useAuthStore((s) => s.setAuth);
  const logoutAction = useAuthStore((s) => s.logout);
  const router = useRouter();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!options.requireAuth || token) return;
    // 沒 token 且需要驗證時:
    //   登入開啟 → 導去登入頁(原本行為)
    //   登入關閉 → 背後用預設 admin 自動登入,不出現登入頁
    if (LOGIN_ENABLED) {
      router.replace("/login");
    } else if (!autoLoginInFlight) {
      autoLoginInFlight = true;
      authService
        .login(AUTO_LOGIN_CREDENTIALS.identifier, AUTO_LOGIN_CREDENTIALS.password)
        .then((d) => setAuth(d.user, d.access, d.refresh))
        .catch(() => {})
        .finally(() => {
          autoLoginInFlight = false;
        });
    }
  }, [options.requireAuth, token, hasHydrated, router, setAuth]);

  // 只在首次掛載拉一次 /auth/me（不掛 deps，避免 token 變動就 re-fire）
  useEffect(() => {
    if (refreshedRef.current) return;
    if (!hasHydrated || !token) return;
    refreshedRef.current = true;
    apiClient.get("/auth/me/").then((r) => setUser(r.data)).catch(() => {});
  }, [hasHydrated, token, setUser]);

  return {
    user,
    token,
    hasHydrated,
    isAuthenticated: hasHydrated && !!token,
    logout: () => {
      logoutAction();
      // 登入關閉時導回主頁(會再自動登入),不要把人丟到登入頁。
      router.replace(LOGIN_ENABLED ? "/login" : "/overview");
    },
  };
}
