import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPricedCatalog } from "@/lib/storePricesServer";
import StoreGrid from "@/components/StoreGrid";

export default async function StoreBadgesPage() {
  const user = await getCurrentUser();
  const isDev = isAdminEmail(user!.email);
  const priced = getPricedCatalog();
  const catalog = isDev ? priced : priced.filter((c) => !c.adminOnly);
  const unlockedCosmetics: string[] = user!.unlockedCosmetics ? JSON.parse(user!.unlockedCosmetics) : [];

  return (
    <StoreGrid
      type="badge"
      catalog={catalog}
      points={user!.points}
      unlockedCosmetics={unlockedCosmetics}
      equippedFrame={user!.equippedFrame}
      equippedBadge={user!.equippedBadge}
      equippedBanner={user!.equippedBanner}
    />
  );
}
