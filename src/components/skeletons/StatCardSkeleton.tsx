export default function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
      <div className="skeleton h-11 w-11 shrink-0 rounded-lg" />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="skeleton h-2.5 w-16 rounded" />
        <div className="skeleton h-5 w-20 rounded" />
      </div>
    </div>
  );
}
