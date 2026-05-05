"use client";
import {
  ChevronDown,
  ChevronRight,
  Cable,
  Database,
  Globe,
  LayoutDashboard,
  Sparkles,
  Target,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

import { cn } from "@/lib/cn";
import { useLeftWingSlotStore } from "@/stores/leftWingSlotStore";
import { useUiStore } from "@/stores/uiStore";
import { useIsWallMode } from "@/stores/wallModeStore";

// 電視牆模式下隱藏的分支(尚未完成 wall layout 適配)
const WALL_HIDDEN_IDS = new Set(["data-validation", "intelligence-validation"]);

type NavLeaf = { kind: "leaf"; id: string; href: string; label: string; icon?: LucideIcon };
type NavBranch = {
  kind: "branch";
  id: string;
  label: string;
  icon?: LucideIcon;
  children: NavNode[];
};
type NavNode = NavLeaf | NavBranch;

const NAV: NavNode[] = [
  { kind: "leaf", id: "overview", href: "/overview", label: "總覽", icon: LayoutDashboard },
  {
    kind: "branch",
    id: "interface-validation",
    label: "連接介面驗證",
    icon: Cable,
    children: [
      {
        kind: "branch",
        id: "interface-dut",
        label: "DUT",
        children: [
          { kind: "leaf", id: "iv-smo", href: "/interface-validation/smo", label: "SMO" },
          { kind: "leaf", id: "iv-ric", href: "/interface-validation/ric", label: "RIC" },
          { kind: "leaf", id: "iv-xapp", href: "/interface-validation/xapp", label: "xApp" },
          { kind: "leaf", id: "iv-rapp", href: "/interface-validation/rapp", label: "rApp" },
        ],
      },
    ],
  },
  {
    kind: "branch",
    id: "data-validation",
    label: "資料品質驗證",
    icon: Database,
    children: [
      {
        kind: "branch",
        id: "data-dut",
        label: "DUT",
        children: [
          { kind: "leaf", id: "dv-smo", href: "/data-validation/smo", label: "SMO" },
          { kind: "leaf", id: "dv-ric", href: "/data-validation/ric", label: "RIC" },
        ],
      },
    ],
  },
  {
    kind: "branch",
    id: "intelligence-validation",
    label: "智慧程度驗證",
    icon: Sparkles,
    children: [
      {
        kind: "branch",
        id: "intelligence-apps",
        label: "DUT",
        children: [
          { kind: "leaf", id: "in-xapp", href: "/intelligence-validation/xapp", label: "xApp" },
          { kind: "leaf", id: "in-rapp", href: "/intelligence-validation/rapp", label: "rApp" },
        ],
      },
    ],
  },
  { kind: "leaf", id: "test-scenarios", href: "/test-scenarios", label: "端對端測試情境", icon: Target },
  {
    kind: "branch",
    id: "site-management",
    label: "場域管理",
    icon: Globe,
    children: [
      { kind: "leaf", id: "site-domestic", href: "/site-management/domestic", label: "國內場域" },
      { kind: "leaf", id: "site-international", href: "/site-management/international", label: "國外場域" },
    ],
  },
];

function hasActiveDescendant(node: NavNode, pathname: string): boolean {
  if (node.kind === "leaf") {
    return pathname === node.href || pathname.startsWith(node.href + "/");
  }
  return node.children.some((c) => hasActiveDescendant(c, pathname));
}

function NavTree({
  nodes,
  pathname,
  depth,
  expandedNavIds,
  toggle,
  flat = false,
}: {
  nodes: NavNode[];
  pathname: string;
  depth: number;
  expandedNavIds: string[];
  toggle: (id: string) => void;
  /** flat=true:展開全部 branch、隱藏 toggle 按鈕、branch 變成靜態節標題,
      避免動態折疊在電視牆下產生 bezel 切割風險。 */
  flat?: boolean;
}) {
  const indent = depth === 0 ? "" : depth === 1 ? "ml-4" : "ml-6";
  return (
    <div className={cn("space-y-0.5", depth > 0 && "border-l border-white/10 pl-2 mt-0.5", indent)}>
      {nodes.map((node) => {
        if (node.kind === "leaf") {
          const active = pathname === node.href || pathname.startsWith(node.href + "/");
          const LeafIcon = node.icon;
          return (
            <Link
              key={node.id}
              href={node.href}
              className={cn(
                "relative flex items-center gap-2 px-3 py-1.5 rounded-item text-sm transition-colors",
                active
                  ? "bg-mint-300/10 text-mint-300 font-medium"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-mint-300 rounded-r" />
              )}
              {LeafIcon && <LeafIcon className="w-4 h-4" strokeWidth={1.5} />}
              <span>{node.label}</span>
            </Link>
          );
        }
        const branchActive = hasActiveDescendant(node, pathname);
        const BranchIcon = node.icon;

        if (flat) {
          // 靜態節標題 — 不可點、不會收合,子項一律渲染。
          return (
            <div key={node.id}>
              <div
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm",
                  branchActive ? "text-mint-300 font-medium" : "text-white/80",
                )}
              >
                {BranchIcon && <BranchIcon className="w-4 h-4" strokeWidth={1.5} />}
                <span>{node.label}</span>
              </div>
              <NavTree
                nodes={node.children}
                pathname={pathname}
                depth={depth + 1}
                expandedNavIds={expandedNavIds}
                toggle={toggle}
                flat
              />
            </div>
          );
        }

        // 一般模式:可折疊
        // Only the explicit list controls expansion now — auto-expand on
        // navigation is handled once via `ensureExpanded` below, so the user
        // can collapse a currently-active branch without it springing back.
        const expanded = expandedNavIds.includes(node.id);
        return (
          <div key={node.id}>
            <button
              type="button"
              onClick={() => toggle(node.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-item text-sm transition-colors",
                branchActive
                  ? "text-mint-300 font-medium"
                  : "text-white/80 hover:bg-white/5 hover:text-white",
              )}
            >
              {BranchIcon && <BranchIcon className="w-4 h-4" strokeWidth={1.5} />}
              <span className="flex-1 text-left">{node.label}</span>
              {expanded
                ? <ChevronDown className="w-4 h-4 text-white/40" />
                : <ChevronRight className="w-4 h-4 text-white/40" />}
            </button>
            {expanded && (
              <NavTree
                nodes={node.children}
                pathname={pathname}
                depth={depth + 1}
                expandedNavIds={expandedNavIds}
                toggle={toggle}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Walks NAV and returns the ids of every branch whose subtree contains the
 * leaf matching `pathname`. Used on navigation to auto-expand the path.
 */
function activeAncestorIds(pathname: string): string[] {
  const out: string[] = [];
  const walk = (nodes: NavNode[], parents: string[]): boolean => {
    let foundHere = false;
    for (const n of nodes) {
      if (n.kind === "leaf") {
        if (pathname === n.href || pathname.startsWith(n.href + "/")) {
          out.push(...parents);
          foundHere = true;
        }
      } else if (walk(n.children, [...parents, n.id])) {
        foundHere = true;
      }
    }
    return foundHere;
  };
  walk(NAV, []);
  return out;
}

export function Sidebar({ className }: { className?: string }) {
  const pathname = usePathname() ?? "";
  const expandedNavIds = useUiStore((s) => s.expandedNavIds);
  const toggleNavItem = useUiStore((s) => s.toggleNavItem);
  const ensureExpanded = useUiStore((s) => s.ensureExpanded);
  const isWall = useIsWallMode();
  const nav = isWall ? NAV.filter((n) => !WALL_HIDDEN_IDS.has(n.id)) : NAV;
  const leftWingSlot = useLeftWingSlotStore((s) => s.content);

  // On every navigation, make sure the branches leading to the current page
  // are expanded — but only ADD ids, never remove. This way a manually
  // collapsed branch stays collapsed even if it contains the active leaf.
  useEffect(() => {
    const ids = activeAncestorIds(pathname);
    if (ids.length) ensureExpanded(ids);
    // Intentionally only run on path change. expandedNavIds is set by this
    // call, listing it here would form a feedback loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <aside className={cn("border-r border-white/10 bg-navy-600/70 backdrop-blur-sm w-64 flex-shrink-0 overflow-y-auto", className)}>
      {/* 一般模式才顯示「智慧驗證 tester」標題;電視牆下浪費 320px 高度,
          把空間還給 nav / slot,讓內容貼到副牆最頂端。 */}
      {!isWall && (
        <div className="p-4 border-b border-white/10">
          <p className="text-lg font-semibold text-white">智慧驗證 tester</p>
          <p className="text-xs text-white/40 mt-1">v1.0.0</p>
        </div>
      )}
      {isWall ? (
        // 電視牆模式:左右排版,左半部 nav 直向堆疊,右半部是
        // page-context slot(各頁面透過 <LeftWingSlot> 註冊內容)。
        <div className="war-room-aside-body">
          <nav className="war-room-nav-vertical">
            <WallNavRow
              href="/overview"
              label="總覽"
              icon={LayoutDashboard}
              pathname={pathname}
            />
            <div className="war-room-nav-group-title">
              <Cable />
              連接介面驗證
            </div>
            <WallNavRow href="/interface-validation/smo" label="SMO" pathname={pathname} compact />
            <WallNavRow href="/interface-validation/ric" label="RIC" pathname={pathname} compact />
            <WallNavRow href="/interface-validation/xapp" label="xApp" pathname={pathname} compact />
            <WallNavRow href="/interface-validation/rapp" label="rApp" pathname={pathname} compact />
            <WallNavRow
              href="/test-scenarios"
              label="端對端測試情境"
              icon={Target}
              pathname={pathname}
            />
            <div className="war-room-nav-group-title">
              <Globe />
              場域管理
            </div>
            <WallNavRow href="/site-management/domestic" label="國內場域" pathname={pathname} compact />
            <WallNavRow href="/site-management/international" label="國外場域" pathname={pathname} compact />
          </nav>
          <div className="war-room-page-slot">
            {leftWingSlot ?? (
              <p className="text-sm text-white/40 px-2">此頁面尚未提供清單區內容</p>
            )}
          </div>
        </div>
      ) : (
        <nav className="p-2">
          <NavTree
            nodes={nav}
            pathname={pathname}
            depth={0}
            expandedNavIds={expandedNavIds}
            toggle={toggleNavItem}
          />
        </nav>
      )}
    </aside>
  );
}

// 電視牆模式 row-style 導航按鈕(直向堆疊用)。
// compact = 縮排 + 較小字,用在群組底下的子項目。
function WallNavRow({
  href,
  label,
  icon: Icon,
  pathname,
  compact = false,
}: {
  href: string;
  label: string;
  icon?: LucideIcon;
  pathname: string;
  compact?: boolean;
}) {
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "war-room-nav-row",
        compact && "war-room-nav-row--compact",
        active && "war-room-nav-row--active",
      )}
    >
      {Icon && <Icon className="war-room-nav-row-icon" strokeWidth={1.5} />}
      <span>{label}</span>
    </Link>
  );
}
