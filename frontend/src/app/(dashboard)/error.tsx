"use client";
import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";

/**
 * dashboard 路由段的 error boundary —— 攔 page 層的例外。
 *
 * 注意:同層 layout.tsx(含 AppShell / 牆版面)的例外 Next.js 不會送到這裡,
 * 那部分由 AppShell 內自行包的 <ErrorBoundary> 負責。
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] 頁面錯誤:", error);
  }, [error]);

  return (
    <div className="flex h-full min-h-64 w-full items-center justify-center p-6">
      <div className="max-w-md rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" />
        <div className="mt-3 text-base font-semibold text-amber-200">此頁無法顯示</div>
        <div className="mt-1 text-sm text-white/50">
          資料來源回傳非預期的格式,其他頁面不受影響。
        </div>
        <div className="mt-3 break-words text-xs text-white/30">{error.message}</div>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg border border-white/15 px-4 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
        >
          重試
        </button>
      </div>
    </div>
  );
}
