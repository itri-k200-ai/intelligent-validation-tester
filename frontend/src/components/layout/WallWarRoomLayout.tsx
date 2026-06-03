"use client";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { HudOctagon } from "@/components/ui/hud-octagon";
import { useRightWingSlotsStore } from "@/stores/rightWingSlotsStore";

import { Header } from "./Header";
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
  const slots = useRightWingSlotsStore((s) => s.slots);

  return (
    <div className="war-room-root">
      {/* === 主牆:IVT 平台頁面內容 === */}
      <section className="war-room-main">
        <div className="war-room-main-topbar">
          <button
            type="button"
            className="war-room-back"
            onClick={() => router.back()}
            title="回上一頁(三個螢幕一起回到主視覺)"
          >
            <ChevronLeft className="w-8 h-8" /> 上一頁
          </button>
        </div>
        <Header />
        <main className="war-room-main-body">{children}</main>
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
