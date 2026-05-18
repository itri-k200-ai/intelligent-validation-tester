"use client";

import { useEffect, useRef, useState } from "react";
import Sidebar from "@/components/Sidebar";
import Chat from "@/components/Chat";

const STORAGE_KEY = "sidebar-width";
const MIN = 260;
const MAX = 560;

export default function HomePage() {
  const [width, setWidth] = useState(320);
  const dragging = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(STORAGE_KEY));
    if (saved >= MIN && saved <= MAX) setWidth(saved);
  }, []);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const w = Math.min(MAX, Math.max(MIN, e.clientX));
      setWidth(w);
    }
    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(STORAGE_KEY, String(width));
      } catch {}
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [width]);

  function startDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return (
    <div className="flex h-screen">
      <div style={{ width }} className="shrink-0">
        <Sidebar />
      </div>
      <div
        onMouseDown={startDrag}
        onDoubleClick={() => {
          setWidth(320);
          try {
            localStorage.setItem(STORAGE_KEY, "320");
          } catch {}
        }}
        className="w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-zinc-200 active:bg-zinc-300 transition-colors relative group"
        title="拖曳調整寬度（雙擊重置）"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>
      <Chat />
    </div>
  );
}
