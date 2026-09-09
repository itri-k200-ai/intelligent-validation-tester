import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type Props = {
  label: string;
  value: string;
  hint?: string;
  tone?: "blue" | "green" | "orange" | "purple";
};

const tones = {
  blue: "border-l-4 border-teal",
  green: "border-l-4 border-mint-300",
  orange: "border-l-4 border-warning",
  purple: "border-l-4 border-mint-500",
};

export function KpiCard({ label, value, hint, tone = "blue" }: Props) {
  return (
    <Card
      data-component="kpi-card"
      className={cn(tones[tone], "kpi-card")}
    >
      <CardContent className="p-3 md:p-4 kpi-card-body">
        <p className="text-xs md:text-sm text-white/60 kpi-card-label">{label}</p>
        <p className="text-xl md:text-2xl font-semibold mt-0.5 kpi-card-value">{value}</p>
        {hint && <p className="text-xs text-white/40 mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  );
}
