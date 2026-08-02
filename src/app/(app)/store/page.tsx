import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { COSMETIC_CATALOG } from "@/lib/cosmetics";
import StoreGrid from "@/components/StoreGrid";

export default async function StorePage() {
  const user = await getCurrentUser();
  const isDev = isAdminEmail(user!.email);
  const catalog = isDev ? COSMETIC_CATALOG : COSMETIC_CATALOG.filter((c) => !c.adminOnly);
  const unlockedCosmetics: string[] = user!.unlockedCosmetics ? JSON.parse(user!.unlockedCosmetics) : [];

  return (
    <StoreGrid
      type="frame"
      catalog={catalog}
      points={user!.points}
      unlockedCosmetics={unlockedCosmetics}
      equippedFrame={user!.equippedFrame}
      equippedBadge={user!.equippedBadge}
      equippedBanner={user!.equippedBanner}
    />
  );
}
