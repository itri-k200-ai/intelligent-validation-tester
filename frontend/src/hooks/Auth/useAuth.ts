"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { apiClient } from "@/services/api/client";
import { useAuthStore } from "@/stores/authStore";

export function useAuth(options: { requireAuth?: boolean } = {}) {
  const { user, token, hasHydrated, logout, setUser } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!hasHydrated) return;
    if (options.requireAuth && !token) {
      router.replace("/login");
    }
  }, [options.requireAuth, token, hasHydrated, router]);

  // 每次掛載（含路由切換 / refresh）都 GET /auth/me/ 拉一次最新 user，
  // 避免 zustand persist 把舊 user schema（缺新欄位 / role 改了）卡在
  // localStorage —— 之前必須登出再登入才看得到新資料的元兇。
  useEffect(() => {
    if (!hasHydrated || !token) return;
    apiClient
      .get("/auth/me/")
      .then((r) => setUser(r.data))
      .catch(() => {
        /* 401 已由 client interceptor 清掉 localStorage，這邊不做 */
      });
  }, [hasHydrated, token, setUser]);

  return {
    user,
    token,
    hasHydrated,
    isAuthenticated: hasHydrated && !!token,
    logout: () => {
      logout();
      router.replace("/login");
    },
  };
}
