import GameCardSkeleton from "@/components/skeletons/GameCardSkeleton";

export default function LibraryLoading() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="skeleton h-7 w-32 rounded" />
        <div className="skeleton mt-2 h-4 w-56 rounded" />
      </div>

      <div className="skeleton h-11 w-full rounded-md" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
