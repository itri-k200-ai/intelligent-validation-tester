"use client";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SelectButton } from "@/components/ui/select-button";
import { useIsWallMode } from "@/stores/wallModeStore";
import type { DutType, Interface } from "@/types/common";
import type { AccessMode, DutInput } from "@/types/dut";
import {
  ACCESS_MODE_LABEL,
  AVAILABLE_INTERFACES,
  DEFAULT_INTERFACES,
} from "@/types/dut";
import type { Site } from "@/types/site";

const ENV_LABEL: Record<string, string> = {
  indoor: "室內",
  outdoor: "室外",
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dutType: DutType;
  sites: Site[];
  onSubmit: (input: DutInput) => Promise<void> | void;
  isSubmitting?: boolean;
};

export function DutFormDialog({
  open,
  onOpenChange,
  dutType,
  sites,
  onSubmit,
  isSubmitting,
}: Props) {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [siteId, setSiteId] = useState("");
  const [interfaces, setInterfaces] = useState<Interface[]>(DEFAULT_INTERFACES[dutType]);
  const [accessMode, setAccessMode] = useState<AccessMode>("unknown");
  const [accessNotes, setAccessNotes] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isWall = useIsWallMode();

  useEffect(() => {
    if (open) {
      setName("");
      setEndpoint("");
      setSiteId(sites[0]?.id ?? "");
      setInterfaces(DEFAULT_INTERFACES[dutType]);
      setAccessMode("unknown");
      setAccessNotes("");
      setSubmitError(null);
    }
  }, [open, dutType, sites]);

  const toggleInterface = (iface: Interface) => {
    setInterfaces((prev) =>
      prev.includes(iface) ? prev.filter((i) => i !== iface) : [...prev, iface],
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (!name.trim() || !endpoint.trim() || !siteId) return;
    try {
      await onSubmit({
        site: siteId,
        name: name.trim(),
        type: dutType,
        endpoint: endpoint.trim(),
        interfaces,
        access_mode: accessMode,
        access_notes: accessNotes.trim(),
      });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { error?: { details?: Record<string, string[]> } } } })
        .response?.data?.error?.details;
      if (detail) {
        const lines = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`);
        setSubmitError(lines.join("\n"));
      } else {
        setSubmitError("新增失敗,請稍後再試");
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl wall-dialog--left-wing">
        <DialogHeader>
          <DialogTitle>新增 {dutType} 設備</DialogTitle>
          <DialogDescription>填寫 {dutType} 設備的連接資訊</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* 電視牆模式:四個欄位橫排在四個 TV cell 裡,讓垂直 bezel 落在
              欄位之間的 gap、不會切過任何輸入框。一般模式維持單欄堆疊。
              `dut-form-grid` 由 globals.css 給 grid-template-columns 對齊
              bezel 位置。 */}
          <div className={isWall ? "dut-form-grid grid gap-6" : "space-y-4"}>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="dut-name">設備名稱</label>
              <Input
                id="dut-name"
                placeholder="輸入設備名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="dut-site">部署場域</label>
              <SelectButton
                id="dut-site"
                value={siteId}
                onChange={setSiteId}
                placeholder={sites.length === 0 ? "（尚無場域）" : undefined}
                options={sites.map((s) => ({
                  value: s.id,
                  label: `${s.name}（${ENV_LABEL[s.environment] ?? s.environment}）`,
                }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="dut-endpoint">API Endpoint</label>
              <Input
                id="dut-endpoint"
                placeholder="192.168.1.100:8080 或 http://smo.example.com/api"
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">測試介面</label>
              <div className="border rounded-item p-3 bg-white/5 grid grid-cols-1 gap-3">
                {AVAILABLE_INTERFACES[dutType].map((iface) => (
                  <label key={iface} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-white/20"
                      checked={interfaces.includes(iface)}
                      onChange={() => toggleInterface(iface)}
                    />
                    <span className="text-sm">{iface} 介面</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="dut-access-mode">
                取得 DUT 方式
              </label>
              <select
                id="dut-access-mode"
                className="flex h-9 w-full rounded-item border border-white/20 bg-navy-400 text-white px-3 text-sm"
                value={accessMode}
                onChange={(e) => setAccessMode(e.target.value as AccessMode)}
              >
                {(Object.keys(ACCESS_MODE_LABEL) as AccessMode[]).map((m) => (
                  <option key={m} value={m}>{ACCESS_MODE_LABEL[m]}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="dut-access-notes">
                Access 註記（跳板機 / VPN / 寄送單號…）
              </label>
              <Input
                id="dut-access-notes"
                placeholder="例：bench-3 頂上機架；jump@10.0.0.1"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={isSubmitting || !siteId}>
              {isSubmitting ? "送出中…" : "新增設備"}
            </Button>
          </div>
          {sites.length === 0 && (
            <p className="text-xs text-warning">
              系統尚未偵測到任何場域,請先於「場域管理」建立場域。
            </p>
          )}
          {submitError && (
            <p className="whitespace-pre-line rounded-item border border-danger/40 bg-danger/10 p-2 text-xs text-danger">
              {submitError}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
