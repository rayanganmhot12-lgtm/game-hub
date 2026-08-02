import { prisma } from "@/lib/prisma";

const DEV_BADGE_ID = "badge-developer";
const ADMIN_BADGE_ID = "badge-admin";

// Grants the reserved "Dev" and "Admin" badges to the admin account the
// first time their own layout renders each session — a no-op after that.
// Neither is ever purchasable in the Store or granted to anyone else that
// way; the Admin tab's grant/revoke controls are the only way anyone else
// ever gets them (see grantAdminBadge/revokeAdminBadge in moderationRealtime.ts).
export async function ensureDevBadge(userId: string, unlockedCosmeticsJson: string | null) {
  const owned: string[] = unlockedCosmeticsJson ? JSON.parse(unlockedCosmeticsJson) : [];
  const toAdd = [DEV_BADGE_ID, ADMIN_BADGE_ID].filter((id) => !owned.includes(id));
  if (toAdd.length === 0) return;
  await prisma.user.update({
    where: { id: userId },
    data: { unlockedCosmetics: JSON.stringify([...owned, ...toAdd]) },
  });
}
