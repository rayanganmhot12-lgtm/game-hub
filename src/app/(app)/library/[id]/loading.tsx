export default function GameDetailLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="skeleton h-4 w-32 rounded" />

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <div className="skeleton h-48 w-full sm:h-64" />
        <div className="flex flex-col gap-4 p-5">
          <div className="skeleton h-7 w-1/2 rounded" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="skeleton h-12 rounded-md" />
            <div className="skeleton h-12 rounded-md" />
            <div className="skeleton h-12 rounded-md" />
          </div>
        </div>
      </div>

      <div className="skeleton h-40 rounded-lg" />
    </div>
  );
}
