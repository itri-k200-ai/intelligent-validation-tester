"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  WALL_SELECTION_CHANNEL,
  mockSelectionService,
} from "@/services/Selection/mockSelectionService";
import { useWallSelectionStore, type WallSelection } from "@/stores/wallSelectionStore";

/**
 * 牆的選擇同步(左 → 中/右)。Phase 1 起改走純前端 BroadcastChannel +
 * localStorage,帶完整 payload(dutName/interface/testcaseId),不依賴後端
 * (IVT 選擇後端將退場,之後由 RICtester 接手跨機器同步)。同瀏覽器跨分頁即時。
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

    setConnected(true);
    // 初次補水:從 localStorage 拿目前選擇
    mockSelectionService.current().then((p) => p && apply(p as WallSelection));
    // 跨分頁即時:BroadcastChannel
    const ch = new BroadcastChannel(WALL_SELECTION_CHANNEL);
    ch.onmessage = (ev) => apply(ev.data as WallSelection | null);
    return () => ch.close();
  }, [setSelection, setConnected]);
}
