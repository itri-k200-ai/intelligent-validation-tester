"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

// 根路徑導向 /overview,並保留 query(?wall=left|center|right)。
// 登入已關,不再需要 landing 頁;這樣直接開 http://host/?wall=center
// 也能落到牆版面(dashboard 路由才會套 region)。
export default function RootRedirect() {
  const router = useRouter();
  useEffect(() => {
    const search = typeof window !== "undefined" ? window.location.search : "";
    router.replace(`/overview${search}`);
  }, [router]);
  return null;
}
