import { prisma } from "@/lib/prisma";
import { computeAchievementsOverview } from "@/lib/achievements";

export interface RecapData {
  trackingSince: Date;
  totalGames: number;
  totalPlaytimeMinutes: number;
  mostPlayedGame: { title: string; coverImageUrl: string | null; playtimeMinutes: number } | null;
  achievementsUnlocked: number;
  achievementsAvailable: number;
  lifetimePointsEarned: number;
}

// All-time totals come straight from Steam's own real playtime figures (not
// scoped to when Game Hub started tracking) — only the achievements and
// points figures are genuinely limited to what's happened since then.
export async function computeRecap(userId: string): Promise<RecapData> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { createdAt: true, lifetimePointsEarned: true },
  });

  const ownedGames = await prisma.ownedGame.findMany({
    where: { account: { userId } },
    include: { game: true },
    orderBy: { playtimeMinutes: "desc" },
  });

  const totalPlaytimeMinutes = ownedGames.reduce((sum, og) => sum + og.playtimeMinutes, 0);
  const top = ownedGames[0];

  const achievements = await computeAchievementsOverview(userId);

  return {
    trackingSince: user.createdAt,
    totalGames: ownedGames.length,
    totalPlaytimeMinutes,
    mostPlayedGame: top
      ? { title: top.game.title, coverImageUrl: top.game.coverImageUrl, playtimeMinutes: top.playtimeMinutes }
      : null,
    achievementsUnlocked: achievements.totalUnlocked,
    achievementsAvailable: achievements.totalAvailable,
    lifetimePointsEarned: user.lifetimePointsEarned,
  };
}
