"use client";
import { useEffect, type ReactNode } from "react";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { useWallRegion } from "@/hooks/Wall/useWallRegion";
import { useUiStore } from "@/stores/uiStore";
import { useIsWallMode } from "@/stores/wallModeStore";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { WallLeftSimulator } from "./WallLeftSimulator";
import { WallModeApplier } from "./WallModeApplier";
import { WallModeOff } from "./WallModeOff";
import { WallWarRoomLayout } from "./WallWarRoomLayout";

export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const isWall = useIsWallMode();
  const region = useWallRegion();

  // 分頁標題依 region 標出左/中/右,方便同時開多個 URL 分辨。
  useEffect(() => {
    const suffix = { all: "", left: "（左）", center: "（中牆）", right: "（右翼）" }[region];
    document.title = `智慧驗證 tester${suffix}`;
  }, [region]);

  // 左螢幕:全螢幕的共通性測試平台模擬器(不走牆版面 / 不裁切)。
  // 這裡在 (dashboard)/layout 之內,同層的 error.tsx 攔不到,所以自己包 boundary。
  if (region === "left")
    return (
      <>
        {/* 確保沒有殘留的牆面畫布縮放 —— 左螢幕是一般頁面 */}
        <WallModeOff />
        <ErrorBoundary label="左螢幕模擬器">
          <WallLeftSimulator />
        </ErrorBoundary>
      </>
    );

  // 單螢幕拆分(center/right)一律走牆版面 —— 那才是該 URL 要顯示的那面牆。
  const forceWall = region === "center" || region === "right";

  if (isWall || forceWall) {
    return (
      <>
        <WallModeApplier />
        <ErrorBoundary label="戰情牆">
          <WallWarRoomLayout>{children}</WallWarRoomLayout>
        </ErrorBoundary>
      </>
    );
  }

  return (
    <div className="flex h-screen">
      <WallModeApplier />
      <Sidebar className="hidden md:flex md:flex-col" />
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-40 md:hidden"
            onClick={() => useUiStore.getState().setSidebarOpen(false)}
          />
          <Sidebar className="fixed inset-y-0 left-0 z-50 md:hidden flex flex-col" />
        </>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <ErrorBoundary label="頁面內容">{children}</ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
