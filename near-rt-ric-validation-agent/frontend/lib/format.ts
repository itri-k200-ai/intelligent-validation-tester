/**
 * Pure formatting helpers. Locale-aware (pass Lang explicitly), no
 * dependency on the i18n dictionary itself.
 */

import type { Lang } from "./i18n";

export function relTime(unixSec: number, lang: Lang): string {
  const now = Date.now() / 1000;
  const diff = now - unixSec;
  if (lang === "en") {
    if (diff < 60) return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(unixSec * 1000).toLocaleDateString("en-CA");
  }
  if (diff < 60) return `${Math.floor(diff)} 秒前`;
  if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return new Date(unixSec * 1000).toLocaleDateString("zh-TW");
}

export function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

/** ISO timestamp → "HH:MM" in the user's local timezone. */
export function fmtTime(iso: string | undefined | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Milliseconds → "850 ms" / "12 s" / "1 m 32 s". */
export function fmtDuration(ms: number | undefined | null): string {
  if (ms == null || !isFinite(ms) || ms < 0) return "";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m} m` : `${m} m ${rest} s`;
}
