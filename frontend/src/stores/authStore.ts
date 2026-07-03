import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types/auth";

// Mock 模式(NEXT_PUBLIC_USE_MOCK=true)下,前端不接後端、也不需要登入 ——
// 直接帶入一組假身分讓 requireAuth 通過,登入頁整個跳過。身分與
// services/Auth/mockAuthService 的 MOCK_USER 一致。正式 build
// (USE_MOCK=false)完全不受影響,登入照舊。
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const MOCK_AUTH = {
  user: {
    id: "11111111-1111-1111-1111-111111111111",
    email: "admin@ivt.local",
    username: "admin",
    role: "admin",
    must_change_password: false,
  } as User,
  token: "mock-access",
  refresh: "mock-refresh",
};

type AuthState = {
  user: User | null;
  token: string | null;
  refresh: string | null;
  hasHydrated: boolean;
  setAuth: (user: User, token: string, refresh: string) => void;
  setUser: (user: User) => void;  // 用來 /auth/me 拉回最新 user 不動 token
  logout: () => void;
  setHasHydrated: (v: boolean) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: USE_MOCK ? MOCK_AUTH.user : null,
      token: USE_MOCK ? MOCK_AUTH.token : null,
      refresh: USE_MOCK ? MOCK_AUTH.refresh : null,
      hasHydrated: false,
      setAuth: (user, token, refresh) => set({ user, token, refresh }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, token: null, refresh: null }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "ivt-auth",
      partialize: (s) => ({ user: s.user, token: s.token, refresh: s.refresh }),
      onRehydrateStorage: () => (state) => {
        // Mock 模式即使 localStorage 曾被登出/清空,也一律回到已登入。
        if (USE_MOCK && state && !state.token) {
          state.setAuth(MOCK_AUTH.user, MOCK_AUTH.token, MOCK_AUTH.refresh);
        }
        state?.setHasHydrated(true);
      },
    },
  ),
);
