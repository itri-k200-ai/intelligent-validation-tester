import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { User } from "@/types/auth";

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
      user: null,
      token: null,
      refresh: null,
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
        state?.setHasHydrated(true);
      },
    },
  ),
);
