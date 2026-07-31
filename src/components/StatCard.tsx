import { LucideIcon } from "lucide-react";
import CountUp from "@/components/CountUp";

export default function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  const isPlainInteger = /^\d+$/.test(value);

  return (
    <div className="panel panel-hover flex items-center gap-4 p-4">
      <div className="icon-badge h-11 w-11 shrink-0">
        <Icon size={22} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted">{label}</p>
        <p className="truncate text-xl font-semibold text-foreground">
          {isPlainInteger ? <CountUp value={Number(value)} /> : value}
        </p>
      </div>
    </div>
  );
}
