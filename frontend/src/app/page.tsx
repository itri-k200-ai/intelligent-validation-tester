"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 根路徑導向,並保留 query(?wall=left|center|right)。
//
// 帶 wall 參數 → /wall:中牆固定停在這個 URL,顯示什麼由左螢幕寫進
// IVT selection 決定,不再靠路由切換。(左螢幕自己不看路由 —— AppShell
// 在 region=left 時直接 return selector;右副牆是靜態內容。)
// 沒帶 wall → /overview:筆電上的一般模式,走側邊選單的既有路由。
export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    const isWall = new URLSearchParams(search).has("wall");
    router.replace(`${isWall ? "/wall" : "/overview"}${search}`);
  }, [router]);
  return null;
}
