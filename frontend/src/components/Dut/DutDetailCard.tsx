"use client";
import { CheckCircle2, Circle, XCircle, Play, Pencil } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/common/StatusBadge";
import { formatDate } from "@/lib/formatters";
import { ACCESS_MODE_LABEL, type Dut, type InterfaceTestResult } from "@/types/dut";

const ENV_LABEL: Record<string, string> = { indoor: "室內", outdoor: "室外" };

type IfaceStatus = "pass" | "fail" | "none";

function ifaceStatus(
  iface: string,
  result: InterfaceTestResult | null,
): IfaceStatus {
  if (!result || !(iface in result.results)) return "none";
  return result.results[iface].ok ? "pass" : "fail";
}

const IFACE_COPY: Record<IfaceStatus, { label: string; desc: string; tone: "green" | "red" | "gray" }> = {
  pass: { label: "通過", desc: "連接正常,資料格式驗證通過", tone: "green" },
  fail: { label: "失敗", desc: "連接失敗或資料格式錯誤", tone: "red" },
  none: { label: "未測試", desc: "尚未測試", tone: "gray" },
};

export function DutDetailCard({
  dut,
  testResult,
  onRunTest,
}: {
  dut: Dut;
  testResult: InterfaceTestResult | null;
  onRunTest: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle>{dut.name}</CardTitle>
            <p className="mt-1 text-sm text-white/60">
              {dut.type} · <span className="font-mono text-xs">{dut.endpoint}</span>
            </p>
          </div>
          <StatusBadge status={dut.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <section>
          <h4 className="font-medium mb-3">連接資訊</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-white/70">資料格式</div>
              <div className="mt-1">{dut.data_format || "未知"}</div>
            </div>
            <div>
              <div className="text-white/70">回應時間</div>
              <div className="mt-1">
                {dut.response_time_ms != null ? `${dut.response_time_ms}ms` : "-"}
              </div>
            </div>
            <div>
              <div className="text-white/70">最後檢查時間</div>
              <div className="mt-1">{formatDate(dut.last_check)}</div>
            </div>
            <div>
              <div className="text-white/70">部署場域</div>
              <div className="mt-1 flex items-center gap-2">
                <span>{dut.site_name ?? "-"}</span>
                {dut.site_environment && (
                  <Badge tone="gray">
                    {ENV_LABEL[dut.site_environment] ?? dut.site_environment}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </section>
        <section>
          <h4 className="font-medium mb-3">設備身份</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-white/70">廠商</div>
              <div className="mt-1">{(dut as any).vendor || <span className="text-white/40">—</span>}</div>
            </div>
            <div>
              <div className="text-white/70">型號</div>
              <div className="mt-1">{(dut as any).model || <span className="text-white/40">—</span>}</div>
            </div>
            <div>
              <div className="text-white/70">Firmware</div>
              <div className="mt-1 font-mono text-xs">
                {(dut as any).firmware_version || <span className="text-white/40">—</span>}
              </div>
            </div>
            <div>
              <div className="text-white/70">序號</div>
              <div className="mt-1 font-mono text-xs">
                {(dut as any).serial_number || <span className="text-white/40">—</span>}
              </div>
            </div>
            <div>
              <div className="text-white/70">部署日期</div>
              <div className="mt-1">{(dut as any).deployed_at || <span className="text-white/40">—</span>}</div>
            </div>
            <div>
              <div className="text-white/70">聯絡 Email</div>
              <div className="mt-1 text-xs">
                {(dut as any).contact_email || <span className="text-white/40">—</span>}
              </div>
            </div>
          </div>
        </section>
        <section>
          <h4 className="font-medium mb-3">驗測情境（agent 用）</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-white/70">取得 DUT 方式</div>
              <div className="mt-1">
                <Badge tone="gray">
                  {ACCESS_MODE_LABEL[((dut as any).access_mode ?? "unknown") as keyof typeof ACCESS_MODE_LABEL] ?? (dut as any).access_mode ?? "未指定"}
                </Badge>
              </div>
            </div>
            <div className="col-span-2">
              <div className="text-white/70">Access 註記</div>
              <div className="mt-1 text-xs whitespace-pre-line">
                {(dut as any).access_notes || <span className="text-white/40">—</span>}
              </div>
            </div>
          </div>
        </section>
        <section>
          <h4 className="font-medium mb-3">介面測試結果</h4>
          <div className="space-y-2">
            {dut.interfaces.map((iface) => {
              const s = ifaceStatus(iface, testResult);
              const copy = IFACE_COPY[s];
              return (
                <div
                  key={iface}
                  className="flex items-center justify-between p-3 border rounded-item"
                >
                  <div className="flex items-center gap-3">
                    {s === "pass" && <CheckCircle2 className="w-5 h-5 text-mint-300" />}
                    {s === "fail" && <XCircle className="w-5 h-5 text-danger" />}
                    {s === "none" && <Circle className="w-5 h-5 text-white/40" />}
                    <div>
                      <div className="text-sm font-medium">{iface} 介面</div>
                      <div className="text-xs text-white/70">{copy.desc}</div>
                    </div>
                  </div>
                  <Badge tone={copy.tone}>{copy.label}</Badge>
                </div>
              );
            })}
            {dut.interfaces.length === 0 && (
              <p className="text-sm text-white/40">此設備未設定任何介面</p>
            )}
          </div>
        </section>
        <div className="flex gap-3">
          <Button className="flex-1" onClick={onRunTest}>
            <Play className="w-4 h-4 mr-2" /> 執行介面測試
          </Button>
          <Button variant="outline" disabled>
            <Pencil className="w-4 h-4 mr-2" /> 編輯設定
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
