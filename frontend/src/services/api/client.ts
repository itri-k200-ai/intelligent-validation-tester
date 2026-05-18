import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from "axios";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000/api";

type AuthState = { state?: { token?: string | null; refresh?: string | null } };

function readAuth(): AuthState["state"] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("ivt-auth");
    if (!raw) return null;
    return (JSON.parse(raw) as AuthState).state ?? null;
  } catch {
    return null;
  }
}

function writeTokens(access: string, refresh?: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("ivt-auth");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state = {
      ...(parsed.state ?? {}),
      token: access,
      ...(refresh ? { refresh } : {}),  // ROTATE_REFRESH_TOKENS=True 會吐新 refresh，要存
    };
    window.localStorage.setItem("ivt-auth", JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
}

function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("ivt-auth");
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE,
  timeout: 15_000,
});

apiClient.interceptors.request.use((config) => {
  const auth = readAuth();
  if (auth?.token) {
    config.headers.Authorization = `Bearer ${auth.token}`;
  }
  return config;
});

// 同時間多個 401 → 只跑一次 refresh，其他等候同一個 promise
let refreshPromise: Promise<string> | null = null;
function doRefresh(): Promise<string> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const auth = readAuth();
    if (!auth?.refresh) throw new Error("no refresh token");
    const r = await axios.post(`${API_BASE}/auth/refresh/`, { refresh: auth.refresh });
    const data = r.data as { access?: string; refresh?: string };
    if (!data.access) throw new Error("refresh: no access in response");
    writeTokens(data.access, data.refresh);
    return data.access;
  })().finally(() => {
    // refresh 完（成功或失敗）清掉 promise，下次 401 可以再試
    setTimeout(() => { refreshPromise = null; }, 0);
  });
  return refreshPromise;
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as
      (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined;
    const status = error.response?.status;

    // 沒 401，原樣丟回
    if (status !== 401 || !original) return Promise.reject(error);

    // refresh endpoint 自己 401 = refresh 也死了 → 清乾淨踢回 login
    if (original.url?.includes("/auth/refresh/")) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }

    // 已重試過還是 401 → 認證真的壞了
    if (original._retried) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(error);
    }
    original._retried = true;

    try {
      const newAccess = await doRefresh();
      original.headers = original.headers ?? {};
      (original.headers as Record<string, string>).Authorization = `Bearer ${newAccess}`;
      return apiClient.request(original as AxiosRequestConfig);
    } catch (refreshErr) {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      return Promise.reject(refreshErr);
    }
  },
);
