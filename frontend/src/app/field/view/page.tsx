"use client";
import { FieldTestResponsive } from "@/components/FieldTest/FieldTestResponsive";
import { useScenarioAutoFollow } from "@/hooks/FieldTest/useScenarioAutoFollow";

/**
 * 來賓用的純監控頁(/field/view):內容、版面與 /field 完全相同,只是拿掉「開始驗測」——
 * 給來賓看的螢幕不能讓人自己驅動載具。
 *
 * ⚠ 這只是畫面上沒有按鈕;驅動走的 adapter API(/ric/im/autoTest/test)本身沒有權限檢查,
 *   知道網址的人仍然打得到。要真的擋,得在 nginx 或 adapter 那層加驗證。
 */
export default function FieldViewPage() {
  // 室內 / 室外跟著「最後一次操作」自動切換,規則與 /field、中牆相同
  useScenarioAutoFollow();
  return <FieldTestResponsive canDrive={false} />;
}
