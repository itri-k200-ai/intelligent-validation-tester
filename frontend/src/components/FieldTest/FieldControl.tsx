"use client";
import { FieldDrivePanel } from "@/components/FieldTest/FieldDrivePanel";
import { FieldTestResponsive } from "@/components/FieldTest/FieldTestResponsive";

/**
 * 驗測控制頁(/field/control):內容同 /field,多一塊「驅動測試」。
 *
 * 跟只能看的 /field 分開,是因為這頁按下去載具會真的動。
 *
 * ⚠ 刻意**不**跟著「最後一次操作」自動切換室內 / 室外(/field 會):操作的人正要驅動室內時,
 *   別人指定看室外的歷史,這頁就會跳走,驅動按鈕跟著變成室外的 —— 很容易按錯。
 *   情境只由操作的人自己切。
 */
export function FieldControl() {
  return (
    <FieldTestResponsive
      title="場域測試 · 驗測控制"
      controls={({ scenario, running }) => <FieldDrivePanel scenario={scenario} running={running} />}
    />
  );
}
