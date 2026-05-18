"use client";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useDutList } from "@/hooks/Dut/useDutList";
import { useSites } from "@/hooks/Site/useSites";
import type { DutType } from "@/types/common";
import type {
  ScenarioCategory,
  TestScenario,
  TestScenarioInput,
  ValidationType,
} from "@/types/scenario";
import { SCENARIO_CATEGORY_LABEL, VALIDATION_TYPE_LABEL } from "@/types/scenario";

const DEFAULT_FORM: TestScenarioInput = {
  name: "",
  site: "",
  source_dut: null,
  validation_type: "data-validation",
  dut_type: "",
  ai_case: "",
  category: "ground-floor",
  collected_at: null,
  row_count: null,
  description: "",
  parameters: {},
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSubmitting: boolean;
  existing?: TestScenario | null;
  onSubmit: (input: TestScenarioInput) => Promise<void>;
};

function toLocalInput(iso: string | null): string | null {
  // datetime-local wants YYYY-MM-DDTHH:MM (no timezone)
  if (!iso) return null;
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScenarioFormDialog({
  open, onOpenChange, isSubmitting, existing, onSubmit,
}: Props) {
  const [form, setForm] = useState<TestScenarioInput>(DEFAULT_FORM);
  const { data: sitesData } = useSites();
  const sites = sitesData?.items ?? [];
  const { duts } = useDutList(
    form.dut_type ? { type: form.dut_type as DutType } : {},
  );

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setForm({
        name: existing.name,
        site: existing.site ?? "",
        source_dut: existing.source_dut ?? null,
        validation_type: existing.validation_type,
        dut_type: existing.dut_type,
        ai_case: existing.ai_case,
        category: existing.category,
        collected_at: toLocalInput(existing.collected_at),
        row_count: existing.row_count,
        description: existing.description,
        parameters: existing.parameters,
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [open, existing]);

  const handleSubmit = () => {
    if (!form.name || !form.site) return;
    void onSubmit({
      ...form,
      collected_at: form.collected_at || null,
      row_count: form.row_count ?? null,
    });
  };

  const isEdit = !!existing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯測試情境" : "新增測試情境"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">情境名稱 *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例:地下停車場 RSRP 量測"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">場域 *</label>
              <select
                className="flex h-9 w-full rounded-item border border-white/20 bg-navy-400 text-white px-3 text-sm"
                value={form.site}
                onChange={(e) => setForm({ ...form, site: e.target.value })}
              >
                <option value="">-- 請選擇 --</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.region === "domestic" ? "國內" : "國外"})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">類別 *</label>
              <select
                className="flex h-9 w-full rounded-item border border-white/20 bg-navy-400 text-white px-3 text-sm"
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as ScenarioCategory })
                }
              >
                {(Object.keys(SCENARIO_CATEGORY_LABEL) as ScenarioCategory[]).map((c) => (
                  <option key={c} value={c}>{SCENARIO_CATEGORY_LABEL[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">驗證類型 *</label>
              <select
                className="flex h-9 w-full rounded-item border border-white/20 bg-navy-400 text-white px-3 text-sm"
                value={form.validation_type}
                onChange={(e) =>
                  setForm({ ...form, validation_type: e.target.value as ValidationType })
                }
              >
                {(Object.keys(VALIDATION_TYPE_LABEL) as ValidationType[]).map((v) => (
                  <option key={v} value={v}>{VALIDATION_TYPE_LABEL[v]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">DUT 類型</label>
              <select
                className="flex h-9 w-full rounded-item border border-white/20 bg-navy-400 text-white px-3 text-sm"
                value={form.dut_type}
                onChange={(e) => setForm({ ...form, dut_type: e.target.value, source_dut: null })}
              >
                <option value="">-- 不指定 --</option>
                <option value="SMO">SMO</option>
                <option value="Near-RT RIC">Near-RT RIC</option>
                <option value="Non-RT RIC">Non-RT RIC</option>
                <option value="xApp">xApp</option>
                <option value="rApp">rApp</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">來源 DUT</label>
              <select
                className="flex h-9 w-full rounded-item border border-white/20 bg-navy-400 text-white px-3 text-sm"
                value={form.source_dut ?? ""}
                onChange={(e) => setForm({ ...form, source_dut: e.target.value || null })}
                disabled={!form.dut_type}
              >
                <option value="">-- 不指定 --</option>
                {duts.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">AI Case</label>
              <Input
                value={form.ai_case}
                onChange={(e) => setForm({ ...form, ai_case: e.target.value })}
                placeholder="CCO / ES / Load Balance / QoE"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">收集時間</label>
              <Input
                type="datetime-local"
                value={form.collected_at ?? ""}
                onChange={(e) => setForm({ ...form, collected_at: e.target.value || null })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">資料筆數</label>
              <Input
                type="number" min={0}
                value={form.row_count ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    row_count: e.target.value === "" ? null : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">描述</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !form.name || !form.site}>
            {isSubmitting ? (isEdit ? "儲存中…" : "建立中…") : (isEdit ? "儲存" : "新增")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
