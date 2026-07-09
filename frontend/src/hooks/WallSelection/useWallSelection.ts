"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { WALL_SELECTION_CHANNEL } from "@/services/Selection/mockSelectionService";
import { selectionService } from "@/services";
import { useWallSelectionStore, type WallSelection } from "@/stores/wallSelectionStore";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "ws://localhost:8001/ws";
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

type SelectionMessage = {
  type: "selection_changed";
  payload: WallSelection | null;
};

/**
 * 訂閱選擇廣播,把左螢幕的選擇灌進 wallSelectionStore,並在收到導覽目標
 * (href)時把中牆導航過去 —— 右牆內容隨頁面切換。整個 app 只掛一次。
 *
 * - 真後端:WebSocket `/ws/selection/`(連上先補水)。
 * - Mock:BroadcastChannel 跨分頁同步(免後端),初次從 localStorage 補水。
 */
export function useWallSelection() {
  const setSelection = useWallSelectionStore((s) => s.setSelection);
  const setConnected = useWallSelectionStore((s) => s.setConnected);
  const router = useRouter();
  const pathname = usePathname();
  const navRef = useRef({ router, pathname });
  navRef.current = { router, pathname };

  useEffect(() => {
    const apply = (payload: WallSelection | null) => {
      setSelection(payload);
      const href = payload?.href;
      if (href && href !== navRef.current.pathname) {
        navRef.current.router.push(href);
      }
    };

    // ── Mock:BroadcastChannel + localStorage 補水 ──
    if (USE_MOCK) {
      setConnected(true);
      selectionService.current().then((p) => p && apply(p as WallSelection));
      const ch = new BroadcastChannel(WALL_SELECTION_CHANNEL);
      ch.onmessage = (ev) => apply(ev.data as WallSelection | null);
      return () => ch.close();
    }

    // ── 真後端:WebSocket ──
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const connect = () => {
      ws = new WebSocket(`${WS_BASE}/selection/`);
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as SelectionMessage;
        if (msg.type === "selection_changed") apply(msg.payload);
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
