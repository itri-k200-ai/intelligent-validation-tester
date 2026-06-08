"use client";
import { ChevronLeft, LogOut, SquareDashed, Tv, Tv2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { HudOctagon } from "@/components/ui/hud-octagon";
import { useAuth } from "@/hooks/Auth/useAuth";
import { getPageMeta } from "@/lib/pageMeta";
import { useRightWingSlotsStore } from "@/stores/rightWingSlotsStore";
import { useWallModeStore } from "@/stores/wallModeStore";

import { Sidebar } from "./Sidebar";

/**
 * 戰情室版面 — 對應實體三牆配置:
 *
 *   [ 主牆 6×3 ── IVT 平台頁面(現有內容) ]
 *   [ 左副牆 3×3 ── Sidebar 切換選單 ] [ 右副牆 3×3 ── 實驗室簡介 ]
 *
 * 在電視牆預覽下,主牆放畫面上方,兩個副牆「折」到下面並排。
 */
export function WallWarRoomLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const { title, accent } = getPageMeta(pathname);
  const slots = useRightWingSlotsStore((s) => s.slots);
  const { user, logout } = useAuth();
  const isWall = useWallModeStore((s) => s.isWall);
  const toggleWall = useWallModeStore((s) => s.toggle);
  const showBezels = useWallModeStore((s) => s.showBezels);
  const toggleBezels = useWallModeStore((s) => s.toggleBezels);

  return (
    <div className="war-room-root">
      {/* === 主牆:IVT 平台頁面內容 === */}
      <section className="war-room-main">
        {/* 3 欄 grid:[上一頁(left)] [標題置中(center)] [utility(right)]
            War-room layout 下不再 render <Header />,所有最上層的
            action(框線 / 電視牆切換 / user / 登出)都集中在 topbar
            右側,維持單一橫條。 */}
        <div className="war-room-main-topbar">
          <button
            type="button"
            className="war-room-back"
            onClick={() => router.back()}
            title="回上一頁(三個螢幕一起回到主視覺)"
          >
            <ChevronLeft className="w-8 h-8" /> 上一頁
          </button>
          <div className="war-room-main-title">
            {title && (
              <div className={`war-room-main-title-text ${accent ?? "text-white"}`}>
                {title}
              </div>
            )}
          </div>
          <div className="war-room-main-topbar-actions">
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
            <Button
              variant={isWall ? "default" : "ghost"}
              size="sm"
              onClick={toggleWall}
              title={isWall ? "切回一般模式" : "切換到電視牆模式"}
            >
              {isWall ? (
                <>
                  <Tv2 className="h-4 w-4 mr-2" /> 牆面中
                </>
              ) : (
                <>
                  <Tv className="h-4 w-4 mr-2" /> 電視牆
                </>
              )}
            </Button>
            {user && (
              <span className="text-sm text-white/70 hidden sm:inline">
                {user.email}{" "}
                <span className="text-white/40">({user.role})</span>
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={logout} title="登出">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <main className="war-room-main-body">
          {/* 八角 HUD 背景浮水印 — 之後設計師會給正式圖檔,屆時把
              .war-room-main-bg-asset 切到 background-image: url(...)。
              現在先用 inline HudOctagon 給氛圍。 */}
          <div className="war-room-main-bg" aria-hidden="true">
            <HudOctagon kind="radar" className="war-room-main-bg-asset" />
          </div>
          <div className="war-room-main-content">{children}</div>
        </main>
      </section>

      {/* === 左副牆:Sidebar 切換選單 === */}
      <section className="war-room-left">
        <Sidebar className="war-room-sidebar flex flex-col" />
      </section>

      {/* === 右副牆:實驗室概要 + page slots === */}
      <section className="war-room-right">
        <div className="war-room-lab-info">
          {/* 上排:3 個紫色小格,各占一個 TV 螢幕(1920×1080) */}
          <div className="war-room-lab-top">實驗室簡介</div>
          <div className="war-room-lab-top">測試目標</div>
          <div className="war-room-lab-top">合作夥伴</div>
          {/* 下半部:3 個高長條(各跨 2 row),內容由各頁面透過
              <RightWingSlots> 設定;沒設的話顯示分類標題 placeholder。 */}
          <div className="war-room-lab-tall war-room-lab-tall--dut">
            {slots.dut ?? (
              <div className="war-room-slot-placeholder">
                <HudOctagon kind="radar" label="待測物" />
              </div>
            )}
          </div>
          <div className="war-room-lab-tall war-room-lab-tall--equip">
            {slots.equip ?? (
              <div className="war-room-slot-placeholder">
                <HudOctagon kind="tower" label="測試設備" />
              </div>
            )}
          </div>
          <div className="war-room-lab-tall war-room-lab-tall--method">
            {slots.method ?? (
              <div className="war-room-slot-placeholder">
                <HudOctagon kind="neural" label="測試方法" />
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
