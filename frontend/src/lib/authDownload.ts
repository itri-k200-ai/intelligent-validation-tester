import axios from "axios";

/**
 * 從帶 JWT 的 endpoint 下載檔案。
 *
 * 不用 apiClient 是因為 apiClient.baseURL=/api 會跟 API 回來的
 * /api/... 路徑串成 /api/api/... 雙 prefix。這裡 url 預期是
 * 「origin-relative absolute path」（例 /api/agent-artifacts/<id>/download/），
 * 用 raw axios + 從 localStorage 拿 token 手動帶。
 */
export async function authDownload(url: string, filename?: string): Promise<void> {
  const token = readAccessToken();
  const res = await axios.get(url, {
    responseType: "blob",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const blob = res.data as Blob;
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || guessFilenameFromResponse(res.headers) || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("ivt-auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

function guessFilenameFromResponse(headers: unknown): string | null {
  const cd = (headers as Record<string, string>)?.["content-disposition"];
  if (!cd) return null;
  const m = /filename="?([^"]+)"?/.exec(cd);
  return m?.[1] ?? null;
}
