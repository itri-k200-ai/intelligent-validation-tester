import type { Metadata } from "next";

import { FieldControl } from "@/components/FieldTest/FieldControl";

export const metadata: Metadata = {
  title: "場域測試驗測控制",
  description: "室內 AMR / 室外 UAV 場域測試:驅動測試與即時狀態",
};

export default function FieldControlPage() {
  return <FieldControl />;
}
