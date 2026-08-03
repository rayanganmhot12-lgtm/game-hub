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
    // The number is the reason this card exists, so it leads: the label sits
    // above it as a small caption rather than competing at nearly the same
    // size, and the icon moves to the far side so nothing indents the figure.
    <div className="panel panel-hover flex items-start justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
        <p className="stat-value mt-2 truncate">
          {isPlainInteger ? <CountUp value={Number(value)} /> : value}
        </p>
      </div>
      <div className="icon-badge h-10 w-10 shrink-0">
        <Icon size={19} />
      </div>
    </div>
  );
}
