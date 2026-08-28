"use client";

import { useWallSelectionStore } from "@/stores/wallSelectionStore";

/**
 * 中牆標題下方的專案列 —— 顯示左螢幕目前選到哪一項。
 *
 * 版位參考「戰情室標題規格」與通感融合實驗網的主牆:標題底下一行
 * 「專案:XXX」。內容來自 IVT selection(左螢幕寫入 → WS 推播)。
 *
 * 連線中斷時在前面補一個紅點 —— 牆是無人看顧的,斷線若沒有任何提示,
 * 現場只會看到一個「不再更新」的畫面而不知道出事。正常連線時不顯示,
 * 維持規格圖乾淨的樣子。
 */
export function WallSelectionStatus() {
  const selection = useWallSelectionStore((s) => s.selection);
  const connected = useWallSelectionStore((s) => s.connected);

  const label = selection?.label || selection?.name || null;

  return (
    <div className="war-room-main-subtitle-text war-room-project-line">
      {!connected && (
        <span className="war-room-project-offline" title="與左螢幕的連線中斷" />
      )}
      <span>專案：{label ?? "尚未選擇"}</span>
    </div>
  );
}
