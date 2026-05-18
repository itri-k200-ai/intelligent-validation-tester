import { API_BASE } from "@/lib/api";

/**
 * Turn references to `/workspace/foo.zip` (or .tar.gz / .tgz / .tar)
 * inside agent text into clickable download links so users don't have
 * to copy-paste paths. Runs before ReactMarkdown so the substitution
 * just becomes a normal `[text](url)` link.
 */
export function linkifyWorkspaceFiles(text: string): string {
  return text.replace(
    /(\/workspace\/[A-Za-z0-9._\-\/一-鿿]+\.(?:zip|tar\.gz|tgz|tar))/g,
    (full) => {
      const rel = full.replace(/^\/workspace\//, "");
      const url = `${API_BASE}/api/files/?path=${encodeURIComponent(rel)}`;
      return `[📦 ${rel}](${url})`;
    }
  );
}
