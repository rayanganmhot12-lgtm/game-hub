import type { ReactNode } from "react";

// Every page hand-rolled this same title/subtitle pair, which is why their
// sizes and spacing had drifted apart. One component keeps them identical and
// gives a single place to change the opening of every page at once.
export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  // Right-aligned slot for a primary action or a link belonging to the page.
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
