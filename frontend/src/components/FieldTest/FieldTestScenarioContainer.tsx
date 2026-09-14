"use client";
import { EmptyState } from "@/components/common/EmptyState";
import { FIELD_SCENARIOS } from "@/config/fieldScenarios";
import { useIsWallMode } from "@/stores/wallModeStore";
import type { FieldScenarioId } from "@/types/fieldTest";

import { FieldTestWall } from "./FieldTestWall";

/**
 * 場域測試情境(室外 UAV / 室內 AMR)。規劃只有中牆版面,一般模式先提示切到電視牆。
 */
export function FieldTestScenarioContainer({ scenario }: { scenario: FieldScenarioId }) {
  const isWall = useIsWallMode();
  if (!isWall) {
    return (
      <EmptyState
        message={`${FIELD_SCENARIOS[scenario].title}目前只有電視牆版面,請按右上角「電視牆」切換`}
      />
    );
  }
  return <FieldTestWall scenario={scenario} />;
}
