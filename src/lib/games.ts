import { prisma } from "@/lib/prisma";
import type { Platform, Prisma } from "@/generated/prisma/client";

export interface GameFilters {
  q?: string;
  platform?: Platform;
  installed?: boolean;
  backlog?: boolean;
  neverPlayed?: boolean;
  tag?: string;
  sort?: "playtime" | "title" | "lastPlayed";
}

export async function listOwnedGames(userId: string, filters: GameFilters = {}) {
  const where: Prisma.OwnedGameWhereInput = {
    account: filters.platform
      ? { userId, platform: filters.platform }
      : { userId },
  };
  if (filters.q) {
    where.game = { title: { contains: filters.q } };
  }
  if (filters.installed !== undefined) {
    where.installed = filters.installed;
  }
  if (filters.backlog !== undefined) {
    where.backlog = filters.backlog;
  }
  if (filters.neverPlayed) {
    where.playtimeMinutes = 0;
  }
  if (filters.tag) {
    where.tags = { contains: filters.tag };
  }

  const orderBy: Prisma.OwnedGameOrderByWithRelationInput =
    filters.sort === "title"
      ? { game: { title: "asc" } }
      : filters.sort === "lastPlayed"
        ? { lastPlayedAt: "desc" }
        : { playtimeMinutes: "desc" };

  const ownedGames = await prisma.ownedGame.findMany({
    where,
    orderBy,
    include: { game: true, account: true },
  });

  return ownedGames.map((og) => ({
    id: og.id,
    gameId: og.game.id,
    platformGameId: og.game.platformGameId,
    title: og.game.title,
    platform: og.account.platform,
    coverImageUrl: og.game.coverImageUrl,
    playtimeMinutes: og.playtimeMinutes,
    playtimeMinutes2Wk: og.playtimeMinutes2Wk,
    lastPlayedAt: og.lastPlayedAt,
    installed: og.installed,
    rating: og.rating,
    backlog: og.backlog,
    tags: og.tags ? og.tags.split(",") : [],
    unlockedAchievementsCount: og.unlockedAchievements ? JSON.parse(og.unlockedAchievements).length : null,
    totalAchievements: og.totalAchievements,
    accountDisplayName: og.account.displayName,
  }));
}

export async function listUserTags(userId: string): Promise<string[]> {
  const rows = await prisma.ownedGame.findMany({
    where: { account: { userId }, tags: { not: null } },
    select: { tags: true },
  });
  const tagSet = new Set<string>();
  for (const row of rows) {
    row.tags?.split(",").forEach((t) => tagSet.add(t));
  }
  return Array.from(tagSet).sort();
}

export type OwnedGameSummary = Awaited<ReturnType<typeof listOwnedGames>>[number];
