"use client";
import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  /** 出錯區塊的名稱,顯示在 fallback 上,方便在牆上一眼看出是哪一區壞了。 */
  label: string;
  children: ReactNode;
};

type State = { error: Error | null };

/**
 * 區塊級 error boundary —— 把例外侷限在單一牆區。
 *
 * 電視牆是長時間掛著跑的,上游(RICtester)改了欄位或回傳非預期結構時,
 * 不應該讓整個 app 白畫面。包住的區塊出錯就只有該區顯示錯誤訊息,
 * 其餘牆面照常運作。
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 留在 console 供現場排查(牆上不顯示 stack)。
    console.error(`[${this.props.label}] 區塊錯誤:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="flex h-full w-full items-center justify-center p-6">
        <div className="max-w-md rounded-xl border border-amber-400/30 bg-amber-400/10 p-5 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" />
          <div className="mt-3 text-base font-semibold text-amber-200">
            {this.props.label} 無法顯示
          </div>
          <div className="mt-1 text-sm text-white/50">
            資料來源回傳非預期的格式,其餘區塊不受影響。
          </div>
          <div className="mt-3 break-words text-xs text-white/30">{error.message}</div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="mt-4 rounded-lg border border-white/15 px-4 py-1.5 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            重試
          </button>
        </div>
      </div>
    );
  }
}
