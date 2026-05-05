"use client";
import { useEffect } from "react";

import {
  useRightWingSlotsStore,
  type RightWingSlotsValue,
} from "@/stores/rightWingSlotsStore";

/**
 * 頁面用這個元件把內容註冊到電視牆右副牆的 slot。
 *
 *   <RightWingSlots
 *     dut={<DutPanel ... />}
 *     equip={<CameraList ... />}
 *     method={<TopologyView ... />}
 *   />
 *
 * 卸載時自動把 slot 清空,layout 會 fallback 到預設 placeholder。
 * 元件本身不渲染東西,純粹當作一個 effect 來同步 store。
 */
export function RightWingSlots(props: RightWingSlotsValue) {
  useEffect(() => {
    useRightWingSlotsStore.getState().setSlots(props);
    return () => useRightWingSlotsStore.getState().setSlots({});
    // 沒給 deps:每次 props 變動都重新 sync(JSX 在 React diff 下會替換)
  });

  return null;
}
