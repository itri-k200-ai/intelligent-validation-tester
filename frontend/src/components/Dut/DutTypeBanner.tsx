import type { DutType } from "@/types/common";

const STYLES: Record<DutType, { bg: string; border: string; dot: string; text: string }> = {
  SMO:  { bg: "bg-mint-300/10",  border: "border-mint-300/40",   dot: "bg-mint-300",   text: "text-mint-300" },
  "Near-RT RIC": { bg: "bg-teal/10", border: "border-teal/40", dot: "bg-teal", text: "text-teal" },
  "Non-RT RIC":  { bg: "bg-teal/10", border: "border-teal/40", dot: "bg-teal", text: "text-teal" },
  xApp: { bg: "bg-warning/10",   border: "border-warning/40",    dot: "bg-warning",    text: "text-warning" },
  rApp: { bg: "bg-danger/10",    border: "border-danger/40",     dot: "bg-danger",     text: "text-danger" },
};

export function DutTypeBanner({ dutType }: { dutType: DutType }) {
  const s = STYLES[dutType];
  return (
    <div className={`w-fit p-3 rounded-item border ${s.bg} ${s.border} flex items-center gap-2`}>
      <div className={`w-3 h-3 rounded ${s.dot}`} />
      <span className={`text-sm font-medium ${s.text}`}>
        當前檢視:{dutType} 設備
      </span>
    </div>
  );
}
