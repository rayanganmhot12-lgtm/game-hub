import { prisma } from "@/lib/prisma";

export async function computeStats(userId: string) {
  const ownedGames = await prisma.ownedGame.findMany({
    where: { account: { userId } },
    include: { game: true, account: true },
  });

  const totalGames = ownedGames.length;
  const totalPlaytimeMinutes = ownedGames.reduce((sum, og) => sum + og.playtimeMinutes, 0);

  const platformBreakdown = new Map<string, { games: number; playtimeMinutes: number }>();
  for (const og of ownedGames) {
    const entry = platformBreakdown.get(og.account.platform) ?? { games: 0, playtimeMinutes: 0 };
    entry.games += 1;
    entry.playtimeMinutes += og.playtimeMinutes;
    platformBreakdown.set(og.account.platform, entry);
  }

  const recentlyPlayed = ownedGames
    .filter((og) => og.lastPlayedAt)
    .sort((a, b) => b.lastPlayedAt!.getTime() - a.lastPlayedAt!.getTime())
    .slice(0, 6)
    .map((og) => ({
      id: og.id,
      title: og.game.title,
      platform: og.account.platform,
      platformGameId: og.game.platformGameId,
      coverImageUrl: og.game.coverImageUrl,
      lastPlayedAt: og.lastPlayedAt,
      playtimeMinutes: og.playtimeMinutes,
    }));

  const recentActivity = ownedGames
    .filter((og) => og.playtimeMinutes2Wk > 0)
    .sort((a, b) => b.playtimeMinutes2Wk - a.playtimeMinutes2Wk)
    .slice(0, 8)
    .map((og) => ({
      title: og.game.title,
      minutes: og.playtimeMinutes2Wk,
    }));

  return {
    totalGames,
    totalPlaytimeMinutes,
    platformBreakdown: Array.from(platformBreakdown.entries()).map(([platform, v]) => ({
      platform,
      ...v,
    })),
    recentlyPlayed,
    recentActivity,
  };
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day; // Monday-start week
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Diffs consecutive weekly snapshots to derive "minutes played that week"
// from the raw cumulative totals. The first tracked week is baseline-only
// (its jump would include all pre-tracking history) and is excluded.
export async function computePlaytimeTrend(userId: string) {
  const snapshots = await prisma.playtimeSnapshot.findMany({
    where: { userId },
    orderBy: { capturedAt: "asc" },
  });

  if (snapshots.length < 2) {
    return [];
  }

  const weekTotals = new Map<string, { weekStart: Date; total: number; lastCapturedAt: Date }>();
  for (const snap of snapshots) {
    const weekStart = startOfWeek(snap.capturedAt);
    const key = weekStart.toISOString();
    const existing = weekTotals.get(key);
    if (!existing || snap.capturedAt > existing.lastCapturedAt) {
      weekTotals.set(key, { weekStart, total: snap.totalPlaytimeMinutes, lastCapturedAt: snap.capturedAt });
    }
  }

  const weeks = Array.from(weekTotals.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());

  const trend: { weekLabel: string; minutes: number }[] = [];
  for (let i = 1; i < weeks.length; i++) {
    trend.push({
      weekLabel: weeks[i].weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      minutes: Math.max(0, weeks[i].total - weeks[i - 1].total),
    });
  }

  return trend;
}
