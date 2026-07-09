"use client";

import { useWallSelectionStore } from "@/stores/wallSelectionStore";

/**
 * 中牆頂部橫幅:顯示「左 app(左螢幕)目前切到哪個檢視」+ 廣播連線狀態。
 * 這是拆分後跨 app 連動的可視證明 —— 左 app 點選單,這裡與整個中牆即時跟換。
 */
export function WallSelectionStatus() {
  const selection = useWallSelectionStore((s) => s.selection);
  const connected = useWallSelectionStore((s) => s.connected);

  const label = selection?.label || selection?.name || null;

  return (
    <div className="wall-selection-banner flex items-center gap-4 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-white backdrop-blur">
      <span
        className={`inline-block h-2.5 w-2.5 rounded-full ${
          connected ? "bg-emerald-400" : "bg-rose-400"
        }`}
        title={connected ? "已連上左螢幕廣播" : "未連上"}
      />
      <span className="text-sm uppercase tracking-widest text-white/50">
        目前檢視
      </span>
      {label ? (
        <span className="text-xl font-semibold">{label}</span>
      ) : (
        <span className="text-white/40">等待左螢幕選擇…</span>
      )}
    </div>
  );
}
