import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export default function EmptyState({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
}) {
  return (
    // An empty state is often the first thing a new user sees, and a dashed
    // grey box read as something broken rather than something waiting. The
    // accent wash and a larger title make it look intentional.
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-[radial-gradient(120%_100%_at_50%_0%,rgba(var(--accent-rgb),0.07),transparent_62%)] px-6 py-16 text-center">
      <div className="icon-badge h-14 w-14">
        <Icon size={26} />
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {children && <p className="max-w-sm text-sm leading-relaxed text-muted">{children}</p>}
    </div>
  );
}
