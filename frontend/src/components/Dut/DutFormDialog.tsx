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
  const [vendor, setVendor] = useState("");
  const [model, setModel] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  // 對齊 RICtester（Near-RT RIC）
  const [description, setDescription] = useState("");
  const [product, setProduct] = useState("");
  const [version, setVersion] = useState("");
  const [e2Mcc, setE2Mcc] = useState("");
  const [e2Mnc, setE2Mnc] = useState("");
  const [e2GnbId, setE2GnbId] = useState("");
  const [e2CellId, setE2CellId] = useState("");
  const [e2Address, setE2Address] = useState("");
  const [a1Address, setA1Address] = useState("");
  const [o1Address, setO1Address] = useState("");
  const [o1Username, setO1Username] = useState("");
  const [o1Password, setO1Password] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const isWall = useIsWallMode();
  const isRic = dutType === "Near-RT RIC";

  useEffect(() => {
    if (open) {
      setName(""); setEndpoint(""); setSiteId(sites[0]?.id ?? "");
      setInterfaces(DEFAULT_INTERFACES[dutType]);
      setAccessMode("unknown"); setAccessNotes("");
      setVendor(""); setModel(""); setFirmwareVersion("");
      setSerialNumber(""); setContactEmail("");
      setDescription(""); setProduct(""); setVersion("");
      setE2Mcc(""); setE2Mnc(""); setE2GnbId(""); setE2CellId("");
      setE2Address(""); setA1Address(""); setO1Address("");
      setO1Username(""); setO1Password("");
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
        vendor: vendor.trim(),
        model: model.trim(),
        firmware_version: firmwareVersion.trim(),
        serial_number: serialNumber.trim(),
        contact_email: contactEmail.trim(),
        // Near-RT RIC 專屬(對齊 RICtester);其他類型送空值
        description: description.trim(),
        product: product.trim(),
        version: version.trim(),
        e2_mcc: e2Mcc.trim(),
        e2_mnc: e2Mnc.trim(),
        e2_gnb_id: e2GnbId.trim(),
        e2_cell_id: e2CellId.trim(),
        e2_address: e2Address.trim(),
        a1_address: a1Address.trim(),
        o1_address: o1Address.trim(),
        o1_username: o1Username.trim(),
        o1_password: o1Password,
      } as any);
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
          <details className="space-y-2">
            <summary className="cursor-pointer text-sm font-medium text-white/70 hover:text-white">
              設備身份（vendor / firmware / serial）— sign-off 報告用
            </summary>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <Input placeholder="廠商（Nokia / Ericsson / OSC …）"
                value={vendor} onChange={(e) => setVendor(e.target.value)} />
              <Input placeholder="型號"
                value={model} onChange={(e) => setModel(e.target.value)} />
              <Input placeholder="Firmware 版本"
                value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} />
              <Input placeholder="序號"
                value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              <Input placeholder="聯絡 email" type="email"
                value={contactEmail} onChange={(e) => setContactEmail(e.target.value)}
                className="col-span-2" />
            </div>
          </details>

          {isRic && (
            <details open className="space-y-3 rounded-item border border-mint-300/20 bg-mint-300/5 p-3">
              <summary className="cursor-pointer text-sm font-medium text-mint-300">
                Near-RT RIC 驗測資訊（對齊 RIC tester）
              </summary>

              {/* 產品身分 */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <Input placeholder="產品（ex: Acme Near-RT RIC）"
                  value={product} onChange={(e) => setProduct(e.target.value)} />
                <Input placeholder="版本（ex: v2.1.0）"
                  value={version} onChange={(e) => setVersion(e.target.value)} />
                <textarea
                  className="col-span-2 min-h-[60px] w-full rounded-item border border-white/20 bg-navy-400 text-white px-3 py-2 text-sm"
                  placeholder="描述（ex: 受測的 Near-RT RIC）"
                  value={description} onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              {/* E2 身分 — 探針冒充 gNB 連 RIC 用,只驗 A1/O1 可留空 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/60">
                  E2 身分（探針冒充的 gNB 識別碼,選填)
                </label>
                <div className="grid grid-cols-4 gap-3">
                  <Input placeholder="MCC (455)" value={e2Mcc} onChange={(e) => setE2Mcc(e.target.value)} />
                  <Input placeholder="MNC (637)" value={e2Mnc} onChange={(e) => setE2Mnc(e.target.value)} />
                  <Input placeholder="gNB ID" value={e2GnbId} onChange={(e) => setE2GnbId(e.target.value)} />
                  <Input placeholder="Cell ID" value={e2CellId} onChange={(e) => setE2CellId(e.target.value)} />
                </div>
              </div>

              {/* 每介面連線位址 — 只顯示有勾選的介面 */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/60">各介面連線位址</label>
                {interfaces.includes("E2") && (
                  <Input placeholder="E2 — SCTP 位址:埠（ex: 10.3.0.71:32222）"
                    value={e2Address} onChange={(e) => setE2Address(e.target.value)} />
                )}
                {interfaces.includes("A1") && (
                  <Input placeholder="A1 — A1-P URL（ex: http://10.3.0.71:30183）"
                    value={a1Address} onChange={(e) => setA1Address(e.target.value)} />
                )}
                {interfaces.includes("O1") && (
                  <div className="grid grid-cols-3 gap-3">
                    <Input placeholder="O1 — NETCONF 位址:埠"
                      value={o1Address} onChange={(e) => setO1Address(e.target.value)} />
                    <Input placeholder="O1 帳號"
                      value={o1Username} onChange={(e) => setO1Username(e.target.value)} />
                    <Input placeholder="O1 密碼" type="password"
                      value={o1Password} onChange={(e) => setO1Password(e.target.value)} />
                  </div>
                )}
              </div>
            </details>
          )}

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
