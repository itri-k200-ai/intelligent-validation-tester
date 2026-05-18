import { notFound } from "next/navigation";

import { DutManagementContainer } from "@/components/Dut/DutManagementContainer";
import type { DutType } from "@/types/common";

const MAP: Record<string, DutType> = {
  smo: "SMO",
  ric: "Near-RT RIC", // 既有 /ric URL 視為 Near-RT RIC（主要驗測對象）
  "near-rt-ric": "Near-RT RIC",
  "non-rt-ric": "Non-RT RIC",
  xapp: "xApp",
  rapp: "rApp",
};

export default async function InterfaceValidationPage({
  params,
}: {
  params: Promise<{ dutType: string }>;
}) {
  const { dutType } = await params;
  const mapped = MAP[dutType.toLowerCase()];
  if (!mapped) notFound();
  return <DutManagementContainer dutType={mapped} />;
}
