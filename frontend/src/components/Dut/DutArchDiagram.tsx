import type { DutType } from "@/types/common";

function Box({
  title,
  subtitle,
  active,
  activeClass,
}: {
  title: string;
  subtitle: string;
  active: boolean;
  activeClass: string;
}) {
  return (
    <div
      className={`border-2 rounded px-2 py-1.5 transition-all ${
        active ? activeClass : "border-white/20 bg-white/5"
      }`}
    >
      <div className={`text-sm font-semibold ${active ? "" : "text-gray-900"}`}>{title}</div>
      <div className={`text-xs ${active ? "" : "text-white/70"}`}>{subtitle}</div>
    </div>
  );
}

// All sizes/positions in rem so the diagram auto-scales with the root
// font-size — regular root 16px keeps the original 220×270 px footprint;
// wall-mode root 48px scales it 3× to fit the bumped-up label text.
export function DutArchDiagram({ dutType }: { dutType: DutType }) {
  return (
    <div className="bg-white/5 rounded-item p-3 border border-white/15">
      <div className="text-sm font-medium text-white/80 mb-2">架構位置</div>
      <div className="flex justify-center">
        <div
          className="relative"
          style={{ width: "13.75rem", height: "16.875rem" }}
        >
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 220 270"
            preserveAspectRatio="none"
            style={{ zIndex: 0 }}
          >
            <line x1="110" y1="75" x2="110" y2="95" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,3" />
            <line x1="110" y1="180" x2="110" y2="200" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="3,3" />
          </svg>
          <div
            className="absolute"
            style={{ left: "0.625rem", top: 0, width: "12.5rem", zIndex: 1 }}
          >
            <div
              className={`border-2 rounded px-2 py-1.5 transition-all ${
                dutType === "SMO"
                  ? "border-blue-600 bg-blue-100 text-blue-900"
                  : "border-white/20 bg-white/5"
              }`}
            >
              <div className="text-sm font-semibold">SMO</div>
              <div className="text-xs">服務管理與編排</div>
              <div className={`border-2 rounded px-2 py-1 mt-1 transition-all ${
                dutType === "rApp"
                  ? "border-orange-600 bg-orange-100 text-orange-900"
                  : "border-white/20 bg-white"
              }`}>
                <div className="text-xs font-medium">rApp</div>
                <div className="text-xs">非即時應用</div>
              </div>
            </div>
          </div>
          <div
            className="absolute"
            style={{ left: "0.625rem", top: "5.9375rem", width: "12.5rem", zIndex: 1 }}
          >
            <div
              className={`border-2 rounded px-2 py-1.5 transition-all ${
                dutType === "Near-RT RIC" || dutType === "Non-RT RIC"
                  ? "border-green-600 bg-green-100 text-green-900"
                  : "border-white/20 bg-white/5"
              }`}
            >
              <div className="text-sm font-semibold">RIC</div>
              <div className="text-xs">無線接取網路智慧控制器</div>
              <div className={`border-2 rounded px-2 py-1 mt-1 transition-all ${
                dutType === "xApp"
                  ? "border-purple-600 bg-purple-100 text-purple-900"
                  : "border-white/20 bg-white"
              }`}>
                <div className="text-xs font-medium">xApp</div>
                <div className="text-xs">近即時應用</div>
              </div>
            </div>
          </div>
          <div
            className="absolute"
            style={{ left: "0.625rem", top: "12.5rem", width: "12.5rem", zIndex: 1 }}
          >
            <Box title="RAN" subtitle="無線接取網路" active={false} activeClass="" />
          </div>
        </div>
      </div>
    </div>
  );
}
