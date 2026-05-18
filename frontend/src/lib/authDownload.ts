import { apiClient } from "@/services/api/client";

/**
 * 從帶 JWT 的 endpoint 下載檔案，繞過瀏覽器 <a href> 不帶 Authorization
 * header 的限制：用 axios 拿 blob → createObjectURL → 觸發點擊 → revoke。
 */
export async function authDownload(url: string, filename?: string): Promise<void> {
  const res = await apiClient.get(url, { responseType: "blob" });
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

function guessFilenameFromResponse(headers: unknown): string | null {
  const cd = (headers as Record<string, string>)?.["content-disposition"];
  if (!cd) return null;
  const m = /filename="?([^"]+)"?/.exec(cd);
  return m?.[1] ?? null;
}
