"use client";
import { useEffect, useState } from "react";

import { selectionService } from "@/services";
import type { CatalogDut } from "@/services/Selection/selectionService";

// 對齊 IVT 電視牆 Sidebar 的三層階層:群組 → 分類 → 該分類的實際 DUT。
type MenuItem = {
  groupTitle?: string;
  href?: string;
  label?: string;
  child?: boolean;
  dutType?: string;
};

const MENU: MenuItem[] = [
  { href: "/overview", label: "總覽" },
  { groupTitle: "連接介面驗證" },
  { href: "/interface-validation/smo", label: "SMO", child: true, dutType: "SMO" },
  { href: "/interface-validation/near-rt-ric", label: "Near-RT RIC", child: true, dutType: "Near-RT RIC" },
  { href: "/interface-validation/non-rt-ric", label: "Non-RT RIC", child: true, dutType: "Non-RT RIC" },
  { href: "/interface-validation/xapp", label: "xApp", child: true, dutType: "xApp" },
  { href: "/interface-validation/rapp", label: "rApp", child: true, dutType: "rApp" },
  { href: "/test-scenarios", label: "端對端測試情境" },
  { groupTitle: "場域管理" },
  { href: "/site-management/domestic", label: "國內場域", child: true },
  { href: "/site-management/international", label: "國外場域", child: true },
];

const DOT: Record<string, string> = {
  online: "bg-emerald-400",
  offline: "bg-zinc-400",
  error: "bg-rose-400",
};

export function WallLeftSelector({ embedded = false }: { embedded?: boolean }) {
  const [dutsByType, setDutsByType] = useState<Record<string, CatalogDut[]>>({});
  const [activeHref, setActiveHref] = useState<string | null>(null);
  const [activeDutId, setActiveDutId] = useState<string | null>(null);
  const [currentLabel, setCurrentLabel] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [duts, cur] = await Promise.all([
          selectionService.catalog().catch(() => []),
          selectionService.current().catch(() => null),
        ]);
        const grouped: Record<string, CatalogDut[]> = {};
        duts.forEach((d) => (grouped[d.type] = grouped[d.type] || []).push(d));
        setDutsByType(grouped);
        setTotal(duts.length);
        if (cur?.href) setActiveHref(cur.href);
        if (cur?.dutId) setActiveDutId(cur.dutId);
        if (cur?.label) setCurrentLabel(cur.label);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const selectView = async (item: MenuItem) => {
    setActiveHref(item.href ?? null);
    setActiveDutId(null);
    setCurrentLabel(item.label ?? null);
    await selectionService.setSelection({ href: item.href, label: item.label }).catch(() => {});
  };

  const selectDut = async (item: MenuItem, d: CatalogDut) => {
    setActiveHref(item.href ?? null);
    setActiveDutId(d.dutId);
    setCurrentLabel(d.name);
    await selectionService
      .setSelection({ href: item.href, label: d.name, dutId: d.dutId })
      .catch(() => {});
  };

  return (
    <div
      className={`flex flex-col bg-[#070b14] text-[#e8edf6] ${
        embedded ? "h-full w-full" : "h-screen"
      }`}
    >
      <header className="border-b border-white/10 px-7 py-6">
        <div className="text-2xl font-bold tracking-widest">戰情牆選單</div>
        <div className="mt-1 text-xs text-white/40">
          左螢幕控制台 · 點選後 IVT 中‧右牆即時切換
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
        {MENU.map((item, i) => {
          if (item.groupTitle) {
            return (
              <div key={i} className="px-3 pb-2 pt-5 text-sm font-semibold tracking-wider text-[#9fb3d1]">
                {item.groupTitle}
              </div>
            );
          }
          const typeActive = item.href === activeHref && !activeDutId;
          const list = item.dutType ? dutsByType[item.dutType] ?? [] : [];
          return (
            <div key={i}>
              <button
                onClick={() => selectView(item)}
                className={`block w-full rounded-lg px-4 py-3 text-left text-base transition-colors ${
                  item.child ? "ml-3.5" : ""
                } ${
                  typeActive
                    ? "bg-emerald-400/15 font-semibold text-emerald-300"
                    : "text-[#c7d2e3] hover:bg-white/5 hover:text-white"
                }`}
              >
                {item.label}
              </button>
              {item.dutType &&
                (list.length === 0 ? (
                  <div className="ml-9 px-3 py-1.5 text-sm text-white/30">（尚無 DUT）</div>
                ) : (
                  list.map((d) => (
                    <button
                      key={d.dutId}
                      onClick={() => selectDut(item, d)}
                      className={`ml-9 flex w-[calc(100%-2.25rem)] items-center gap-2.5 rounded-r-lg border-l border-white/10 px-3.5 py-2 text-left text-sm transition-colors ${
                        d.dutId === activeDutId
                          ? "bg-emerald-400/10 font-semibold text-emerald-300"
                          : "text-[#9fb3d1] hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${DOT[d.status] ?? "bg-zinc-400"}`} />
                      <span>{d.name}</span>
                    </button>
                  ))
                ))}
            </div>
          );
        })}
      </nav>

      <footer className="border-t border-white/10 px-7 py-3 text-xs text-white/40">
        共 {total} 台待測物
      </footer>
    </div>
  );
}
