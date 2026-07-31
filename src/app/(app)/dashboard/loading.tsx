import StatCardSkeleton from "@/components/skeletons/StatCardSkeleton";
import GameCardSkeleton from "@/components/skeletons/GameCardSkeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="skeleton h-7 w-40 rounded" />
        <div className="skeleton mt-2 h-4 w-64 rounded" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="skeleton h-64 rounded-lg lg:col-span-1" />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:col-span-2 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
