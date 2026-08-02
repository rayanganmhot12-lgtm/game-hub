import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      createdAt: true,
      accounts: true,
      points: true,
      unlockedCosmetics: true,
      equippedFrame: true,
      equippedBadge: true,
      friendCode: true,
      displayName: true,
      avatarDataUrl: true,
      bio: true,
      pronouns: true,
      profileNote: true,
      bannerDataUrl: true,
      equippedBanner: true,
      accentColor: true,
      pinnedCosmeticId: true,
      nameEffect: true,
    },
  });
}

// A Steam persona name couldn't be fetched at connect-time (private profile,
// transient API issue) falls back to the raw SteamID64 — that's a 17-digit
// number, never a real display name, so treat it as unset.
export function isRawSteamId(name: string): boolean {
  return /^\d{15,20}$/.test(name);
}

// Priority: a real linked Steam name > a manually-set override > the email prefix.
export function getDisplayName(user: {
  email: string;
  displayName?: string | null;
  accounts?: { platform: string; displayName: string }[];
}): string {
  const steamAccount = user.accounts?.find((a) => a.platform === "STEAM");
  if (steamAccount && !isRawSteamId(steamAccount.displayName)) return steamAccount.displayName;
  return user.displayName ?? user.email.split("@")[0];
}

// Fetches a user fresh from the DB and shapes it into a SavedAccount entry
// for the session's savedAccounts list. Shared by login (addAccount) and
// switch, which both need to snapshot the currently-active user before
// swapping to a different one.
export async function getSavedAccountEntry(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { accounts: true } });
  if (!user) return null;
  return { userId: user.id, email: user.email, displayName: getDisplayName(user) };
}
