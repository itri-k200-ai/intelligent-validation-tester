"use client";
import { FieldTestResponsive } from "@/components/FieldTest/FieldTestResponsive";

export default function FieldPage() {
  // 室內 / 室外不自動跳轉,完全照使用者自己點的分頁(依現場要求;中牆才會跟著「最後一次操作」跳)
  return <FieldTestResponsive />;
}
