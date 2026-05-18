"use client";
import { SelectButton } from "@/components/ui/select-button";
import { useSites } from "@/hooks/Site/useSites";
import type {
  ScenarioCategory,
  ScenarioFilters as Filters,
  ValidationType,
} from "@/types/scenario";
import { SCENARIO_CATEGORY_LABEL, VALIDATION_TYPE_LABEL } from "@/types/scenario";

type Props = {
  value: Filters;
  onChange: (next: Filters) => void;
};

export function ScenarioFilters({ value, onChange }: Props) {
  const { data: sitesData } = useSites();
  const sites = sitesData?.items ?? [];

  const update = (patch: Partial<Filters>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="grid grid-cols-4 gap-3 p-4 bg-white/5 rounded-item border">
      <Select
        label="場域"
        value={value.site ?? ""}
        onChange={(v) => update({ site: v || undefined })}
        options={[
          { value: "", label: "全部" },
          ...sites.map((s) => ({ value: s.id, label: s.name })),
        ]}
      />
      <Select
        label="類別"
        value={value.category ?? ""}
        onChange={(v) => update({ category: (v as ScenarioCategory) || undefined })}
        options={[
          { value: "", label: "全部" },
          ...(Object.keys(SCENARIO_CATEGORY_LABEL) as ScenarioCategory[]).map((c) => ({
            value: c, label: SCENARIO_CATEGORY_LABEL[c],
          })),
        ]}
      />
      <Select
        label="驗證類型"
        value={value.validation_type ?? ""}
        onChange={(v) => update({ validation_type: (v as ValidationType) || undefined })}
        options={[
          { value: "", label: "全部" },
          ...(Object.keys(VALIDATION_TYPE_LABEL) as ValidationType[]).map((v) => ({
            value: v, label: VALIDATION_TYPE_LABEL[v],
          })),
        ]}
      />
      <Select
        label="DUT 類型"
        value={value.dut_type ?? ""}
        onChange={(v) => update({ dut_type: v || undefined })}
        options={[
          { value: "", label: "全部" },
          { value: "SMO", label: "SMO" },
          { value: "Near-RT RIC", label: "Near-RT RIC" },
          { value: "Non-RT RIC", label: "Non-RT RIC" },
          { value: "xApp", label: "xApp" },
          { value: "rApp", label: "rApp" },
        ]}
      />
    </div>
  );
}

function Select({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm text-white/70 mb-1">{label}</label>
      <SelectButton value={value} onChange={onChange} options={options} />
    </div>
  );
}
