"use client";
import { useEffect, useRef } from "react";

import { selectionService } from "@/services";
import {
  WALL_SELECTION_CHANNEL,
  mockSelectionService,
} from "@/services/Selection/mockSelectionService";
import { useWallSelectionStore, type WallSelection } from "@/stores/wallSelectionStore";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

type SelectionMessage = { type: "selection_changed"; payload: WallSelection | null };

/**
 * 牆的選擇同步(左螢幕 → 中牆)。
 * - mock(單機 demo):BroadcastChannel + localStorage,同瀏覽器跨分頁即時。
 * - real(正式/跨電腦):左螢幕 POST /api/selection/current/ 寫入(存 Redis),
 *   後端再經 Channels 廣播到 /ws/selection/,中牆即時收到。別團隊的左 app
 *   打同一支 API 也一樣連動 —— 三面牆放三台播放主機也沒問題。
 *
 * 中牆固定停在 /wall,**不做路由導航** —— 收到的 selection 只是「要顯示哪種
 * 內容」,由 /wall 頁面自己切換渲染。
 *
 * 右副牆是靜態內容,不掛這個 hook。
 */

/** 從同源推導 WS 位址;NEXT_PUBLIC_WS_BASE 是相對路徑(預設 /ws)。 */
function wsUrl(): string {
  const base = process.env.NEXT_PUBLIC_WS_BASE || "/ws";
  if (base.startsWith("ws://") || base.startsWith("wss://")) return `${base}/selection/`;
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}${base}/selection/`;
}

const RECONNECT_MS = 3000;

export function useWallSelection() {
  const setSelection = useWallSelectionStore((s) => s.setSelection);
  const setConnected = useWallSelectionStore((s) => s.setConnected);
  const closedRef = useRef(false);

  useEffect(() => {
    closedRef.current = false;

    // ── mock:BroadcastChannel(同一個瀏覽器內)──
    if (USE_MOCK) {
      setConnected(true);
      mockSelectionService
        .current()
        .then((p) => p && setSelection(p as WallSelection))
        .catch(() => {});
      const ch = new BroadcastChannel(WALL_SELECTION_CHANNEL);
      ch.onmessage = (ev) => setSelection((ev.data as WallSelection) ?? null);
      return () => ch.close();
    }

    // ── real:後端共享狀態 + WebSocket ──
    let sock: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    // 初次補水:WS 連上時後端也會推一次,但先打 HTTP 讓畫面不用等連線。
    selectionService
      .current()
      .then((p) => setSelection((p as WallSelection) ?? null))
      .catch(() => {});

    const connect = () => {
      if (closedRef.current) return;
      try {
        sock = new WebSocket(wsUrl());
      } catch {
        timer = setTimeout(connect, RECONNECT_MS);
        return;
      }
      sock.onopen = () => setConnected(true);
      sock.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data) as SelectionMessage;
          if (msg.type === "selection_changed") setSelection(msg.payload ?? null);
        } catch {
          /* 忽略無法解析的訊息 */
        }
      };
      sock.onclose = () => {
        setConnected(false);
        // 後端重啟 / 網路抖動都會斷,自己重連,牆不需要有人去按重新整理。
        if (!closedRef.current) timer = setTimeout(connect, RECONNECT_MS);
      };
      sock.onerror = () => sock?.close();
    };
    connect();

    return () => {
      closedRef.current = true;
      if (timer) clearTimeout(timer);
      sock?.close();
    };
  }, [setSelection, setConnected]);
}
