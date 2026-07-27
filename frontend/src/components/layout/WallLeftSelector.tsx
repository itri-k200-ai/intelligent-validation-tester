"use client";
import { useEffect, useState } from "react";

import { selectionService } from "@/services";
import { useAdapterTestList } from "@/hooks/Adapter/useAdapterTestList";

// 上/下方的靜態導覽項(總覽、場域管理);中段「連接介面驗證」改用 adapter
// 的 DUT → scenario → testcase 真階層。
type NavItem = { groupTitle?: string; href?: string; label?: string; child?: boolean };

const TOP_NAV: NavItem[] = [{ href: "/overview", label: "總覽" }];
const BOTTOM_NAV: NavItem[] = [
  { href: "/test-scenarios", label: "端對端測試情境" },
  { groupTitle: "場域管理" },
  { href: "/site-management/domestic", label: "國內場域", child: true },
  { href: "/site-management/international", label: "國外場域", child: true },
];

// adapter 的 DUT 都是 Near-RT RIC → 導到這頁(中/右牆顯示)
const RIC_HREF = "/interface-validation/near-rt-ric";

// 介面顯示順序;測項名前綴(e2.setup → e2)決定它屬於哪個介面。
const IFACE_ORDER = ["E2", "A1", "O1"];

// 從一個 DUT 的所有測項推出它有哪些介面(去重、排序)。
function dutInterfaces(dut: { scenarioList: { testcaseList: { testcaseName: string }[] }[] }): string[] {
  const set = new Set<string>();
  dut.scenarioList.forEach((s) =>
    s.testcaseList.forEach((tc) => {
      const prefix = (tc.testcaseName.split(".")[0] || "").toUpperCase();
      if (prefix) set.add(prefix);
    }),
  );
  return [...set].sort(
    (a, b) => (IFACE_ORDER.indexOf(a) + 1 || 99) - (IFACE_ORDER.indexOf(b) + 1 || 99),
  );
}

export function WallLeftSelector({ embedded = false }: { embedded?: boolean }) {
  const { duts, isLoading } = useAdapterTestList();
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);

  useEffect(() => {
    selectionService
      .current()
      .then((cur) => {
        if (cur?.label) setCurrentLabel(cur.label);
      })
      .catch(() => {});
  }, []);

  // 統一的選擇廣播:href 讓中牆導航,label 顯示,額外帶 adapter id 供之後用。
  const broadcast = async (
    key: string,
    label: string,
    extra: Record<string, string> = {},
  ) => {
    setActiveKey(key);
    setCurrentLabel(label);
    await selectionService
      .setSelection({ href: RIC_HREF, label, ...extra })
      .catch(() => {});
  };

  const navBtn = (item: NavItem, i: number, keyPrefix: string) => {
    if (item.groupTitle) {
      return (
        <div key={`${keyPrefix}-${i}`} className="px-3 pb-2 pt-5 text-sm font-semibold tracking-wider text-[#9fb3d1]">
          {item.groupTitle}
        </div>
      );
    }
    const key = `nav:${item.href}`;
    return (
      <button
        key={`${keyPrefix}-${i}`}
        onClick={() => broadcast(key, item.label ?? "", { href: item.href ?? RIC_HREF } as Record<string, string>)}
        className={`block w-full rounded-lg px-4 py-3 text-left text-base transition-colors ${
          item.child ? "ml-3.5" : ""
        } ${
          activeKey === key
            ? "bg-emerald-400/15 font-semibold text-emerald-300"
            : "text-[#c7d2e3] hover:bg-white/5 hover:text-white"
        }`}
      >
        {item.label}
      </button>
    );
  };

  const testcaseCount = duts.reduce(
    (n, d) => n + d.scenarioList.reduce((m, s) => m + s.testcaseList.length, 0),
    0,
  );

  return (
    <div
      className={`flex flex-col bg-[#070b14] text-[#e8edf6] ${
        embedded ? "h-full w-full" : "h-screen"
      }`}
      // 全螢幕(實體左螢幕)時整體放大,字才夠大;嵌在預覽副牆時不放大。
      style={embedded ? undefined : ({ zoom: 1.6 } as React.CSSProperties)}
    >
      <header className="border-b border-white/10 px-7 py-6">
        <div className="text-2xl font-bold tracking-widest">戰情牆選單</div>
        <div className="mt-1 text-xs text-white/40">
          左螢幕控制台 · 資料來自 RICtester · 點選後中‧右牆即時切換
        </div>
        <div className="mt-4 flex min-h-12 items-center gap-3 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
          <span className="text-xs tracking-widest text-white/50">目前檢視</span>
          {currentLabel ? (
            <span className="text-lg font-semibold">{currentLabel}</span>
          ) : (
            <span className="text-white/40">尚未選擇</span>
          )}
        </div>
      </header>

      <nav className="flex-1 overflow-auto p-4">
        {TOP_NAV.map((item, i) => navBtn(item, i, "top"))}

        {/* === 連接介面驗證:adapter DUT → scenario → testcase === */}
        <div className="px-3 pb-2 pt-5 text-sm font-semibold tracking-wider text-[#9fb3d1]">
          連接介面驗證
        </div>
        {isLoading ? (
          <div className="ml-3.5 px-3 py-2 text-sm text-white/30">載入中…</div>
        ) : duts.length === 0 ? (
          <div className="ml-3.5 px-3 py-2 text-sm text-white/30">（RICtester 尚無 DUT）</div>
        ) : (
          duts.map((d) => {
            const dutKey = `dut:${d.dutName}`;
            const ifaces = dutInterfaces(d);
            return (
              <div key={d.dutName}>
                {/* 第一層:哪個 RIC(DUT)*/}
                <button
                  onClick={() => broadcast(dutKey, d.dutName, { dutName: d.dutName })}
                  className={`ml-3.5 block w-[calc(100%-0.875rem)] rounded-lg px-4 py-3 text-left text-base transition-colors ${
                    activeKey === dutKey
                      ? "bg-emerald-400/15 font-semibold text-emerald-300"
                      : "text-[#c7d2e3] hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {d.dutName}
                </button>
                {/* 第二層:選介面(E2 / A1 / O1)*/}
                {ifaces.map((iface) => {
                  const ifKey = `if:${d.dutName}:${iface}`;
                  return (
                    <button
                      key={ifKey}
                      onClick={() =>
                        broadcast(ifKey, `${d.dutName} · ${iface}`, {
                          dutName: d.dutName,
                          interface: iface,
                        })
                      }
                      className={`ml-9 flex w-[calc(100%-2.25rem)] items-center gap-2 rounded-r-lg border-l border-white/10 px-3.5 py-2 text-left text-sm transition-colors ${
                        activeKey === ifKey
                          ? "bg-emerald-400/10 font-semibold text-emerald-300"
                          : "text-[#9fb3d1] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {iface}
                    </button>
                  );
                })}
              </div>
            );
          })
        )}

        {BOTTOM_NAV.map((item, i) => navBtn(item, i, "bot"))}
      </nav>

      <footer className="border-t border-white/10 px-7 py-3 text-xs text-white/40">
        RICtester · {duts.length} 台 DUT · {testcaseCount} 個測項
      </footer>
    </div>
  );
}
