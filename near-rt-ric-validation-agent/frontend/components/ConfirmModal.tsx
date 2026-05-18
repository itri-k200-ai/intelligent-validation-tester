"use client";

import { useEffect } from "react";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/30 backdrop-blur-sm animate-in fade-in"
      onMouseDown={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-zinc-200 w-[360px] max-w-[92vw] p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 className="text-[15px] font-semibold tracking-tight text-zinc-900">
          {title}
        </h2>
        {message && (
          <p className="text-[13px] text-zinc-600 mt-2 leading-relaxed">
            {message}
          </p>
        )}
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-[13px] font-medium rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            autoFocus
            className={`px-3 py-1.5 text-[13px] font-medium rounded-md text-white transition-colors ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-zinc-900 hover:bg-zinc-700"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
