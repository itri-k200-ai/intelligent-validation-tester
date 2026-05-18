"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { apiClient } from "@/services/api/client";
import { useAuthStore } from "@/stores/authStore";

export function useAuth(options: { requireAuth?: boolean } = {}) {
  // 用 selector 拿 stable reference，避免每次 render setUser 都新 identity
  // 觸發 useEffect 無限重跑 → /auth/me 連環 401 → 一直被登出。
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const setUser = useAuthStore((s) => s.setUser);
  const logoutAction = useAuthStore((s) => s.logout);
  const router = useRouter();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!hasHydrated) return;
    if (options.requireAuth && !token) {
      router.replace("/login");
    }
  }, [options.requireAuth, token, hasHydrated, router]);

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
      router.replace("/login");
    },
  };
}
