import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { COSMETIC_CATALOG } from "@/lib/cosmetics";
import StoreSidebar from "@/components/StoreSidebar";
import StorePlusPromo from "@/components/StorePlusPromo";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isDev = isAdminEmail(user!.email);
  const catalog = isDev ? COSMETIC_CATALOG : COSMETIC_CATALOG.filter((c) => !c.adminOnly);
  const unlockedCosmetics: string[] = user!.unlockedCosmetics ? JSON.parse(user!.unlockedCosmetics) : [];

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <StoreSidebar catalog={catalog} unlockedCosmetics={unlockedCosmetics} />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Store</h1>
          <p className="text-sm text-muted">
            Cosmetic profile flair, unlocked with points earned from actually using Game Hub — playing games,
            unlocking achievements, and syncing. No real money involved.
          </p>
        </div>
        <StorePlusPromo catalog={catalog} points={user!.points} unlockedCosmetics={unlockedCosmetics} />
        {children}
      </div>
    </div>
  );
}
