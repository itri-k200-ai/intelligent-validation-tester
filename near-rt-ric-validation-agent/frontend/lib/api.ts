/**
 * HTTP client wrapper. Owns:
 *   - the `API_BASE` resolution (same-origin in production behind the
 *     middleware proxy, configurable for split-host dev setups)
 *   - cookie-credential transport so the auth cookie rides along
 *   - global 401 → /login redirect
 *
 * Types live in ./types; format helpers in ./format. This file is
 * intentionally thin so all network code shares the same auth contract.
 */

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    credentials: "same-origin",
    ...init,
  });
  if (res.status === 401 && typeof window !== "undefined") {
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

/**
 * SWR-compatible fetcher. Returns `Promise<any>` rather than
 * `Promise<unknown>` so the SWR generic at the call site
 * (`useSWR<MyType>(key, fetcher)`) infers cleanly without each caller
 * having to cast or build their own typed fetcher.
 *
 * The looseness is intentional and contained: every consumer passes a
 * concrete generic, and `apiFetch` itself is typed. New code may also
 * use `apiFetch<T>(path)` directly for explicit typing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const fetcher = (path: string): Promise<any> => apiFetch(path);

// Re-export types for backward compatibility (existing imports still work).
export type {
  Persona,
  Session,
  Message,
  Instance,
} from "./types";
