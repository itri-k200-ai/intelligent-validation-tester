"use client";
import type { ReactNode } from "react";

import { useUiStore } from "@/stores/uiStore";
import { useIsWallMode } from "@/stores/wallModeStore";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { WallModeApplier } from "./WallModeApplier";
import { WallWarRoomLayout } from "./WallWarRoomLayout";

export function AppShell({ children }: { children: ReactNode }) {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const isWall = useIsWallMode();

  if (isWall) {
    return (
      <>
        <WallModeApplier />
        <WallWarRoomLayout>{children}</WallWarRoomLayout>
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
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
