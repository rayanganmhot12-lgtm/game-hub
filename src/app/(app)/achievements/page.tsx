import Link from "next/link";
import Image from "next/image";
import { Trophy } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { computeAchievementsOverview } from "@/lib/achievements";
import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";

export default async function AchievementsPage() {
  const user = await getCurrentUser();
  const overview = await computeAchievementsOverview(user!.id);

  const overallPct =
    overview.totalAvailable > 0 ? Math.round((overview.totalUnlocked / overview.totalAvailable) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Achievements" subtitle="Rolled up across every game we've tracked achievement data for." />

      {overview.games.length === 0 ? (
        <EmptyState icon={Trophy} title="No achievement data yet">
          Achievement progress fills in here as you play games and click Sync — it&apos;s only tracked for
          games actually played since this feature was added.
        </EmptyState>
      ) : (
        <>
          <div className="panel flex items-center gap-4 p-4">
            <div className="icon-badge h-12 w-12 shrink-0">
              <Trophy size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">
                {overview.totalUnlocked} / {overview.totalAvailable} unlocked across {overview.games.length} game
                {overview.games.length > 1 ? "s" : ""}
              </p>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-accent-bright to-accent"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
            </div>
            <span className="shrink-0 text-lg font-semibold text-accent-bright">{overallPct}%</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {overview.games.map((g) => {
              const pct = g.total > 0 ? Math.round((g.unlocked / g.total) * 100) : 0;
              return (
                <Link
                  key={g.id}
                  href={`/library/${g.id}`}
                  className="panel panel-hover flex items-center gap-3 p-3"
                >
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-md bg-surface-2">
                    {g.coverImageUrl && (
                      <Image src={g.coverImageUrl} alt={g.title} fill unoptimized className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{g.title}</p>
                    <p className="text-xs text-muted">
                      {g.unlocked} / {g.total} unlocked
                    </p>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent-bright to-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-accent-bright">{pct}%</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
