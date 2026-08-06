"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  WALL_SELECTION_CHANNEL,
  mockSelectionService,
} from "@/services/Selection/mockSelectionService";
import { useWallSelectionStore, type WallSelection } from "@/stores/wallSelectionStore";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE ?? "/ws";

type SelectionMessage = { type: "selection_changed"; payload: WallSelection | null };

/**
 * 牆的選擇同步(左 → 中/右)。
 * - mock(單機 demo):BroadcastChannel + localStorage,同瀏覽器跨分頁即時。
 * - real(正式/跨電腦):訂閱後端 WebSocket /ws/selection/,別團隊左 app
 *   POST /api/selection/current/ 後,後端廣播 → 中/右牆即時收到。
 *
 * 收到帶 href 的選擇時把中牆導航過去 → 右牆內容隨頁面切換。整個 app 掛一次。
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

    // ── mock:BroadcastChannel(同瀏覽器)──
    if (USE_MOCK) {
      setConnected(true);
      mockSelectionService.current().then((p) => p && apply(p as WallSelection));
      const ch = new BroadcastChannel(WALL_SELECTION_CHANNEL);
      ch.onmessage = (ev) => apply(ev.data as WallSelection | null);
      return () => ch.close();
    }

    // ── real:後端 WebSocket /ws/selection/(跨電腦;連上先補水,斷線自動重連)──
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let closed = false;
    const wsUrl = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const base = WS_BASE.startsWith("/")
        ? `${proto}://${window.location.host}${WS_BASE}`
        : WS_BASE;
      return `${base}/selection/`;
    };
    const connect = () => {
      ws = new WebSocket(wsUrl());
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as SelectionMessage;
          if (msg.type === "selection_changed") apply(msg.payload);
        } catch {
          /* ignore malformed */
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
