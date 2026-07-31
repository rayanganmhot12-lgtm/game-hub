import { prisma } from "@/lib/prisma";

const DEV_BADGE_ID = "badge-developer";

// Grants the reserved "Dev" badge to the admin account the first time their
// own layout renders — a no-op after that. Never purchasable, never granted
// to anyone else.
export async function ensureDevBadge(userId: string, unlockedCosmeticsJson: string | null) {
  const owned: string[] = unlockedCosmeticsJson ? JSON.parse(unlockedCosmeticsJson) : [];
  if (owned.includes(DEV_BADGE_ID)) return;
  await prisma.user.update({
    where: { id: userId },
    data: { unlockedCosmetics: JSON.stringify([...owned, DEV_BADGE_ID]) },
  });
}
