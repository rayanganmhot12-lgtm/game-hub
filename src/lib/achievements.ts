import { prisma } from "@/lib/prisma";

export interface GameAchievementProgress {
  id: string;
  title: string;
  coverImageUrl: string | null;
  unlocked: number;
  total: number;
}

export interface AchievementsOverview {
  totalUnlocked: number;
  totalAvailable: number;
  games: GameAchievementProgress[];
}

// Reads whatever's already been captured during sync (see gameSync.ts's
// diffAchievements) rather than calling Steam's API live for the whole
// library — keeps this page fast, at the cost of only covering games
// that have actually been played since achievement tracking was added.
export async function computeAchievementsOverview(userId: string): Promise<AchievementsOverview> {
  const ownedGames = await prisma.ownedGame.findMany({
    where: { account: { userId }, totalAchievements: { not: null } },
    include: { game: true },
  });

  let totalUnlocked = 0;
  let totalAvailable = 0;

  const games: GameAchievementProgress[] = ownedGames.map((og) => {
    const unlocked = og.unlockedAchievements ? JSON.parse(og.unlockedAchievements).length : 0;
    const total = og.totalAchievements ?? 0;
    totalUnlocked += unlocked;
    totalAvailable += total;
    return {
      id: og.id,
      title: og.game.title,
      coverImageUrl: og.game.coverImageUrl,
      unlocked,
      total,
    };
  });

  games.sort((a, b) => {
    const pctA = a.total > 0 ? a.unlocked / a.total : 0;
    const pctB = b.total > 0 ? b.unlocked / b.total : 0;
    return pctB - pctA;
  });

  return { totalUnlocked, totalAvailable, games };
}
