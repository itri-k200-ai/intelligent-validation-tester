"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import ConfirmModal from "@/components/ConfirmModal";
import LangToggle from "@/components/LangToggle";
import { API_BASE, fetcher } from "@/lib/api";
import { useLang } from "@/lib/LangContext";
import { pick, useAppConfig } from "@/lib/useAppConfig";
import type {
  AgentInfo,
  GeneratedItem,
  Knowledge,
  Persona,
  Session,
} from "@/lib/types";
import CapabilitiesTab from "./CapabilitiesTab";
import KnowledgePanel from "./KnowledgePanel";
import OutputsTab from "./OutputsTab";
import SessionsTab from "./SessionsTab";

/**
 * Sidebar shell: header + tabs + content area + delete-confirm modals.
 *
 * Owns cross-tab concerns:
 *   - which tab is active
 *   - which session/output the user is about to delete (modal state)
 *   - rename PATCH call
 *
 * Each tab's rendering is delegated to its own file. Data fetching
 * (sessions / generated / knowledge / info) uses SWR — declarative
 * caching, automatic revalidation.
 */

type Tab = "capabilities" | "outputs" | "sessions" | "knowledge";

export default function Sidebar() {
  const router = useRouter();
  const params = useSearchParams();
  const currentSession = params.get("s") || "";
  const { t } = useLang();
  const [tab, setTab] = useState<Tab>("capabilities");

  const { data: personas } = useSWR<Persona[]>("/api/personas/", fetcher);
  const { data: generated, mutate: refetchGenerated } = useSWR<{
    items: GeneratedItem[];
  }>("/api/generated/", fetcher, { refreshInterval: 5000 });
  const { data: sessions, mutate: refetchSessions } = useSWR<Session[]>(
    "/api/sessions/",
    fetcher,
    { refreshInterval: 10000 }
  );
  const { data: knowledge } = useSWR<Knowledge>(
    tab === "knowledge" ? "/api/agent/knowledge" : null,
    fetcher
  );
  const { data: info } = useSWR<AgentInfo>(
    tab === "knowledge" ? "/api/agent/info" : null,
    fetcher
  );

  // Pending deletion state — drives the ConfirmModal(s).
  const [pendingDeleteSession, setPendingDeleteSession] = useState<string | null>(null);
  const [pendingDeleteOutput, setPendingDeleteOutput] = useState<string | null>(null);

  const handlers = {
    requestDeleteSession(id: string, e: React.MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      setPendingDeleteSession(id);
    },
    async confirmDeleteSession() {
      const id = pendingDeleteSession;
      setPendingDeleteSession(null);
      if (!id) return;
      await fetch(`${API_BASE}/api/sessions/${id}/`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      refetchSessions();
      if (id === currentSession) router.push("/");
    },
    async renameSession(id: string, newTitle: string) {
      await fetch(`${API_BASE}/api/sessions/${id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: newTitle }),
      });
      refetchSessions();
    },
    requestDeleteOutput(name: string, e: React.MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      setPendingDeleteOutput(name);
    },
    async confirmDeleteOutput() {
      const name = pendingDeleteOutput;
      setPendingDeleteOutput(null);
      if (!name) return;
      await fetch(`${API_BASE}/api/generated/${encodeURIComponent(name)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      refetchGenerated();
    },
    async logout() {
      await fetch(`${API_BASE}/api/auth/logout`, {
        method: "POST",
        credentials: "same-origin",
      });
      window.location.href = "/login";
    },
  };

  const tabs: [Tab, string, number | undefined][] = [
    ["capabilities", t("tab.capabilities"), undefined],
    ["outputs", t("tab.outputs"), generated?.items.length],
    ["sessions", t("tab.sessions"), sessions?.length],
    ["knowledge", t("tab.knowledge"), undefined],
  ];

  return (
    <aside className="w-full h-full border-r border-zinc-200 bg-white flex flex-col">
      <SidebarHeader onNewConversation={() => router.push("/")} />
      <TabBar tabs={tabs} active={tab} onChange={setTab} />

      <div className="flex-1 overflow-y-auto">
        {tab === "capabilities" && <CapabilitiesTab />}
        {tab === "outputs" && (
          <OutputsTab
            items={generated?.items ?? []}
            onDelete={handlers.requestDeleteOutput}
          />
        )}
        {tab === "sessions" && (
          <SessionsTab
            sessions={sessions}
            current={currentSession}
            onDelete={handlers.requestDeleteSession}
            onRename={handlers.renameSession}
          />
        )}
        {tab === "knowledge" && (
          <KnowledgePanel knowledge={knowledge} info={info} />
        )}
      </div>

      <SidebarFooter onLogout={handlers.logout} />

      <ConfirmModal
        open={pendingDeleteSession !== null}
        title={t("sessions.delete.title")}
        message={t("sessions.delete.confirm")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handlers.confirmDeleteSession}
        onCancel={() => setPendingDeleteSession(null)}
      />
      <ConfirmModal
        open={pendingDeleteOutput !== null}
        title={t("outputs.delete.title")}
        message={t("outputs.delete.confirm")}
        confirmLabel={t("common.confirm")}
        cancelLabel={t("common.cancel")}
        destructive
        onConfirm={handlers.confirmDeleteOutput}
        onCancel={() => setPendingDeleteOutput(null)}
      />
    </aside>
  );
}

function SidebarHeader({
  onNewConversation,
}: {
  onNewConversation: () => void;
}) {
  const { t, lang } = useLang();
  const config = useAppConfig();
  return (
    <div className="px-5 pt-4 pb-3 border-b border-zinc-200">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="text-[15px] font-semibold tracking-tight text-zinc-900">
          {pick(config.app.name, lang)}
        </div>
        <LangToggle />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          {pick(config.app.description, lang) && (
            <p className="text-[11px] text-zinc-500 mt-0.5 tracking-tight line-clamp-2">
              {pick(config.app.description, lang)}
            </p>
          )}
        </div>
        <button
          onClick={onNewConversation}
          title={t("sidebar.new.title")}
          className="h-7 px-2.5 text-[11px] font-medium bg-zinc-900 text-white rounded-md hover:bg-zinc-700 transition-colors whitespace-nowrap"
        >
          {t("sidebar.new")}
        </button>
      </div>
    </div>
  );
}

function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: [Tab, string, number | undefined][];
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav className="flex border-b border-zinc-200">
      {tabs.map(([id, label, count]) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex-1 py-2.5 text-[13px] tracking-tight transition-colors relative ${
              isActive
                ? "text-zinc-900 font-semibold"
                : "text-zinc-500 hover:text-zinc-900"
            }`}
          >
            {label}
            {count !== undefined && count > 0 && (
              <span
                className={`ml-1 px-1 rounded text-[11px] tabular-nums ${
                  isActive
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-600"
                }`}
              >
                {count}
              </span>
            )}
            {isActive && (
              <span className="absolute bottom-0 left-3 right-3 h-px bg-zinc-900" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarFooter({ onLogout }: { onLogout: () => void }) {
  const { t } = useLang();
  return (
    <div className="px-5 py-3 border-t border-zinc-200 flex items-center justify-between text-[13px]">
      <span className="text-zinc-400">v0.1</span>
      <button
        onClick={onLogout}
        className="text-zinc-500 hover:text-zinc-900 transition-colors"
      >
        {t("auth.logout")}
      </button>
    </div>
  );
}
