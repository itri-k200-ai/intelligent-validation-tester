"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { useWallSelectionStore, type WallSelection } from "@/stores/wallSelectionStore";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8001/ws";

type SelectionMessage = {
  type: "selection_changed";
  payload: WallSelection | null;
};

/**
 * 訂閱 `/ws/selection/`,把左 app 的選擇即時灌進 wallSelectionStore,
 * 並在收到導覽目標(href)時把中牆導航過去 —— 右牆內容隨頁面切換。
 * 連上時後端會先推一則目前選擇(補水)。斷線自動重連。
 * 整個 app 只需在牆版面掛一次。
 */
export function useWallSelection() {
  const setSelection = useWallSelectionStore((s) => s.setSelection);
  const setConnected = useWallSelectionStore((s) => s.setConnected);
  const router = useRouter();
  const pathname = usePathname();
  // router/pathname 放 ref,避免每次導航都重連 WS。
  const navRef = useRef({ router, pathname });
  navRef.current = { router, pathname };

  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/selection/`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as SelectionMessage;
        if (msg.type !== "selection_changed") return;
        setSelection(msg.payload);
        const href = msg.payload?.href;
        if (href && href !== navRef.current.pathname) {
          navRef.current.router.push(href);
        }
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 2000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [setSelection, setConnected]);
}
