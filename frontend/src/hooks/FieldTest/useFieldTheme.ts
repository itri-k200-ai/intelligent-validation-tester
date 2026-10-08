"use client";
import { useCallback, useEffect, useState } from "react";

export type FieldTheme = "dark" | "light";
const KEY = "ivt-field-theme";

/**
 * /field 與 /field/control 的亮色 / 暗色模式。
 *
 * 做法:在 <html> 掛 data-field-theme="light",由 globals.css 那一段把頁面用到的顏色
 * class 換成亮色版(見「/field 亮色模式」)。掛在 <html> 而不是頁面外框,是因為彈窗
 * (驗測報告、確認視窗)是 portal 到 <body> 底下的,不在頁面外框裡。
 * 離開頁面時拿掉,不影響其他頁面(牆面一律暗色)。
 *
 * 選擇存在這台瀏覽器;沒選過就是暗色(原本的樣子)。
 */
export function useFieldTheme() {
  const [theme, setTheme] = useState<FieldTheme>("dark");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "light" || saved === "dark") setTheme(saved);
    } catch {
      /* 拿不到 localStorage(私密模式等):維持暗色 */
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "light") root.dataset.fieldTheme = "light";
    else delete root.dataset.fieldTheme;
    return () => {
      delete root.dataset.fieldTheme;
    };
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next: FieldTheme = t === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* 存不了就只在這次有效 */
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
