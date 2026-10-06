"use client";
import { FieldTestResponsive } from "@/components/FieldTest/FieldTestResponsive";
import { useScenarioAutoFollow } from "@/hooks/FieldTest/useScenarioAutoFollow";

export default function FieldPage() {
  // 室內 / 室外跟著「最後一次操作」自動切換,規則與中牆相同
  useScenarioAutoFollow();
  return <FieldTestResponsive />;
}
