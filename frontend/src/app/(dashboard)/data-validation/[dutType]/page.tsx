import { notFound } from "next/navigation";

import { DataValidationContainer } from "@/components/DataValidation/DataValidationContainer";
import type { DataValidationDutType } from "@/components/DataValidation/DataValidationContainer";

const MAP: Record<string, DataValidationDutType> = {
  smo: "SMO",
  ric: "Near-RT RIC", // 既有 /ric URL 視為 Near-RT RIC（主要驗測對象）
  "near-rt-ric": "Near-RT RIC",
  "non-rt-ric": "Non-RT RIC",
};

export default async function DataValidationPage({
  params,
}: {
  params: Promise<{ dutType: string }>;
}) {
  const { dutType } = await params;
  const mapped = MAP[dutType.toLowerCase()];
  if (!mapped) notFound();
  return <DataValidationContainer dutType={mapped} />;
}
