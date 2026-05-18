"use client";
import { Play, Plus } from "lucide-react";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { useBaseline } from "@/hooks/DataValidation/useBaseline";
import { useDataValidationRun } from "@/hooks/DataValidation/useDataValidationRun";
import { useRegisterDut } from "@/hooks/DataValidation/useRegisterDut";
import { useDutList } from "@/hooks/Dut/useDutList";
import type { Dut } from "@/types/dut";

import { BaselineCard } from "./BaselineCard";
import { BaselineEditorDialog } from "./BaselineEditorDialog";
import { DataValidationDutList } from "./DataValidationDutList";
import { RegisterDutDialog } from "./RegisterDutDialog";
import { RunValidationDialog } from "./RunValidationDialog";
import { ValidationResultCard } from "./ValidationResultCard";

export type DataValidationDutType = "SMO" | "Near-RT RIC" | "Non-RT RIC";

export function DataValidationContainer({ dutType }: { dutType: DataValidationDutType }) {
  const { duts, isLoading, refresh } = useDutList({ type: dutType, has_baseline: true });
  const [selected, setSelected] = useState<Dut | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [runOpen, setRunOpen] = useState(false);

  const { baseline, isLoading: baselineLoading, save, isSaving } = useBaseline(selected?.id ?? null);
  const { run, result, isRunning, reset } = useDataValidationRun();
  const { register, isRegistering } = useRegisterDut();

  useEffect(() => {
    setSelected(null);
    reset();
  }, [dutType, reset]);

  useEffect(() => {
    if (!selected) return;
    const refreshed = duts.find((d) => d.id === selected.id);
    if (refreshed && refreshed !== selected) setSelected(refreshed);
    if (!refreshed && !isLoading) setSelected(null);
  }, [duts, selected, isLoading]);

  return (
    <>
      <PageHeader title={`資料品質驗證 - ${dutType}`}>
        <Button onClick={() => setRegisterOpen(true)}>
          <Plus className="w-4 h-4 mr-2" /> 添加 DUT
        </Button>
      </PageHeader>
      <p className="-mt-3 mb-4 text-sm text-white/70">
        針對已註冊的 {dutType} 設備執行資料完整性、準確性與即時性驗證
      </p>
      <div className="space-y-4">
        <DataValidationDutList
          duts={duts}
          isLoading={isLoading}
          selectedId={selected?.id ?? null}
          onSelect={(d) => { setSelected(d); reset(); }}
        />
        {selected && (
          <>
            <BaselineCard
              dut={selected}
              baseline={baseline}
              isLoading={baselineLoading}
              onEdit={() => setEditorOpen(true)}
            />
            <div className="flex justify-end">
              <Button
                onClick={() => setRunOpen(true)}
                disabled={isRunning || !baseline}
              >
                <Play className="w-4 h-4 mr-2" />
                {isRunning ? "驗證中…" : "執行驗證"}
              </Button>
            </div>
            {result && <ValidationResultCard result={result} />}
          </>
        )}
      </div>
      {selected && (
        <BaselineEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          dutName={selected.name}
          baseline={baseline}
          isSaving={isSaving}
          onSubmit={async (input) => {
            await save(input);
            setEditorOpen(false);
          }}
        />
      )}
      {selected && baseline && (
        <RunValidationDialog
          open={runOpen}
          onOpenChange={setRunOpen}
          dutName={selected.name}
          baseline={baseline}
          isRunning={isRunning}
          onRun={async (scenarioId) => {
            await run({ dutId: selected.id, scenarioId });
            setRunOpen(false);
          }}
        />
      )}
      <RegisterDutDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        dutType={dutType}
        isSubmitting={isRegistering}
        onSubmit={async (dutId, input) => {
          await register({ dutId, input });
          const refreshed = await refresh();
          const found = refreshed.data?.items.find((d) => d.id === dutId) ?? null;
          if (found) setSelected(found);
          setRegisterOpen(false);
        }}
      />
    </>
  );
}
