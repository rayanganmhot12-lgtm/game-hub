import { prisma } from "@/lib/prisma";
import { fetchOwnedGames, fetchAchievements, steamCoverImageUrl, steamHeaderImageUrl } from "@/lib/steam";
import { getInstalledSteamAppIds } from "@/lib/steamLocal";

export interface NewAchievement {
  gameTitle: string;
  achievementName: string;
}

export interface SyncResult {
  count: number;
  newAchievements: NewAchievement[];
  pointsEarned: number;
}

export async function syncSteamLibrary(accountId: string, steamId: string): Promise<SyncResult> {
  const games = await fetchOwnedGames(steamId);
  const newAchievements: NewAchievement[] = [];
  let newMinutesPlayed = 0;

  for (const g of games) {
    const game = await prisma.game.upsert({
      where: { platform_platformGameId: { platform: "STEAM", platformGameId: String(g.appid) } },
      update: {
        title: g.name,
        coverImageUrl: steamCoverImageUrl(g.appid),
        headerImageUrl: steamHeaderImageUrl(g.appid),
      },
      create: {
        platform: "STEAM",
        platformGameId: String(g.appid),
        title: g.name,
        coverImageUrl: steamCoverImageUrl(g.appid),
        headerImageUrl: steamHeaderImageUrl(g.appid),
      },
    });

    const existing = await prisma.ownedGame.findUnique({
      where: { accountId_gameId: { accountId, gameId: game.id } },
      select: { playtimeMinutes: true, unlockedAchievements: true },
    });

    await prisma.ownedGame.upsert({
      where: { accountId_gameId: { accountId, gameId: game.id } },
      update: {
        playtimeMinutes: g.playtime_forever,
        playtimeMinutes2Wk: g.playtime_2weeks ?? 0,
        lastPlayedAt: g.rtime_last_played ? new Date(g.rtime_last_played * 1000) : null,
      },
      create: {
        accountId,
        gameId: game.id,
        playtimeMinutes: g.playtime_forever,
        playtimeMinutes2Wk: g.playtime_2weeks ?? 0,
        lastPlayedAt: g.rtime_last_played ? new Date(g.rtime_last_played * 1000) : null,
      },
    });

    // Only worth checking achievements for games actually played since the
    // last sync — keeps this to a handful of extra API calls per sync
    // instead of two more per game in the entire library every time.
    const playedSinceLastSync = existing !== null && g.playtime_forever > existing.playtimeMinutes;
    if (playedSinceLastSync) {
      newMinutesPlayed += g.playtime_forever - existing!.playtimeMinutes;
      const unlocked = await diffAchievements(
        accountId,
        game.id,
        g.appid,
        steamId,
        existing!.unlockedAchievements,
        g.name
      );
      newAchievements.push(...unlocked);
    }
  }

  await syncInstalledStatus(accountId);

  await prisma.account.update({
    where: { id: accountId },
    data: { lastSyncedAt: new Date() },
  });

  await recordPlaytimeSnapshot(accountId);

  const pointsEarned = await awardPoints(accountId, newAchievements.length, newMinutesPlayed);

  return { count: games.length, newAchievements, pointsEarned };
}

// Mock in-app currency — a small reward loop tied to real usage (achievement
// unlocks, new playtime logged), not real money. Every sync earns something.
async function awardPoints(accountId: string, newAchievementCount: number, newMinutesPlayed: number) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { userId: true } });
  if (!account) return 0;

  const SYNC_BONUS = 10;
  const POINTS_PER_ACHIEVEMENT = 5;
  const POINTS_PER_30_MIN = 1;

  const earned =
    SYNC_BONUS + newAchievementCount * POINTS_PER_ACHIEVEMENT + Math.floor(newMinutesPlayed / 30) * POINTS_PER_30_MIN;

  await prisma.user.update({
    where: { id: account.userId },
    data: { points: { increment: earned }, lifetimePointsEarned: { increment: earned } },
  });

  return earned;
}

// Diffs against the last known unlock state to find achievements unlocked
// since the previous sync. If there's no prior baseline (first time this
// particular game's playtime has moved since we started tracking it), this
// just establishes the baseline silently rather than reporting the game's
// entire unlock history as "new".
async function diffAchievements(
  accountId: string,
  gameId: string,
  appid: number,
  steamId: string,
  previousRaw: string | null,
  gameTitle: string
): Promise<NewAchievement[]> {
  try {
    const achievements = await fetchAchievements(appid, steamId);
    if (achievements.length === 0) return [];

    const currentlyUnlocked = achievements.filter((a) => a.achieved);
    await prisma.ownedGame.update({
      where: { accountId_gameId: { accountId, gameId } },
      data: {
        unlockedAchievements: JSON.stringify(currentlyUnlocked.map((a) => a.apiName)),
        totalAchievements: achievements.length,
      },
    });

    if (previousRaw === null) return [];

    const previouslyUnlocked = new Set<string>(JSON.parse(previousRaw));
    return currentlyUnlocked
      .filter((a) => !previouslyUnlocked.has(a.apiName))
      .map((a) => ({ gameTitle, achievementName: a.name }));
  } catch {
    return [];
  }
}

// One snapshot of the user's grand total playtime (across every account) per
// sync — the raw material for a longer-range trend chart, since Steam itself
// only exposes "last 2 weeks" and "all time" figures, nothing in between.
async function recordPlaytimeSnapshot(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId }, select: { userId: true } });
  if (!account) return;

  const total = await prisma.ownedGame.aggregate({
    where: { account: { userId: account.userId } },
    _sum: { playtimeMinutes: true },
  });

  await prisma.playtimeSnapshot.create({
    data: {
      userId: account.userId,
      totalPlaytimeMinutes: total._sum.playtimeMinutes ?? 0,
    },
  });
}

// Reflects what's actually installed on this PC's Steam client. Best-effort:
// if local detection isn't possible (non-Windows, Steam not found), leaves
// existing installed flags untouched rather than wiping them out.
async function syncInstalledStatus(accountId: string) {
  try {
    const installedAppIds = await getInstalledSteamAppIds();
    if (!installedAppIds) return;

    const ownedGames = await prisma.ownedGame.findMany({
      where: { accountId },
      select: { id: true, game: { select: { platformGameId: true } } },
    });

    const installedIds = ownedGames
      .filter((og) => installedAppIds.has(og.game.platformGameId))
      .map((og) => og.id);
    const notInstalledIds = ownedGames
      .filter((og) => !installedAppIds.has(og.game.platformGameId))
      .map((og) => og.id);

    if (installedIds.length > 0) {
      await prisma.ownedGame.updateMany({ where: { id: { in: installedIds } }, data: { installed: true } });
    }
    if (notInstalledIds.length > 0) {
      await prisma.ownedGame.updateMany({ where: { id: { in: notInstalledIds } }, data: { installed: false } });
    }
  } catch (err) {
    console.error("Local Steam install detection failed:", err);
  }
}
