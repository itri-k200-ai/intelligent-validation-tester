"use client";
import { LogOut, Menu, SquareDashed } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/Auth/useAuth";
import { getPageMeta } from "@/lib/pageMeta";
import { useUiStore } from "@/stores/uiStore";
import { useWallModeStore } from "@/stores/wallModeStore";

export function Header() {
  const { user, logout } = useAuth();
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const isWall = useWallModeStore((s) => s.isWall);
  const showBezels = useWallModeStore((s) => s.showBezels);
  const toggleBezels = useWallModeStore((s) => s.toggleBezels);
  const pathname = usePathname() ?? "";
  const { title, subtitle, accent } = getPageMeta(pathname);

  return (
    <header className="h-14 border-b border-white/10 bg-navy-600/70 backdrop-blur-sm flex items-center justify-between px-4 md:px-6 gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
        {title && (
          <div className="min-w-0 leading-tight">
            <div className={`header-title font-semibold truncate ${accent ?? "text-white"}`}>
              {title}
            </div>
            {subtitle && (
              <div className="header-subtitle text-white/60 text-xs truncate">{subtitle}</div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        {isWall && (
          <Button
            variant={showBezels ? "default" : "ghost"}
            size="sm"
            onClick={toggleBezels}
            title={showBezels ? "隱藏電視框線" : "顯示電視框線"}
          >
            <SquareDashed className="h-4 w-4 mr-2" />
            {showBezels ? "框線中" : "框線"}
          </Button>
        )}
        {user && (
          <span className="text-sm text-white/70 hidden sm:inline">
            {user.email} <span className="text-white/40">({user.role})</span>
          </span>
        )}
        <Button variant="ghost" size="icon" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
