import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { isAdminEmail } from "@/lib/admin";
import { getPricedCatalog } from "@/lib/storePricesServer";
import StoreSidebar from "@/components/StoreSidebar";
import StorePlusPromo from "@/components/StorePlusPromo";
import StoreProfilePreview from "@/components/StoreProfilePreview";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const isDev = isAdminEmail(user!.email);
  const priced = getPricedCatalog();
  const catalog = isDev ? priced : priced.filter((c) => !c.adminOnly);
  const unlockedCosmetics: string[] = user!.unlockedCosmetics ? JSON.parse(user!.unlockedCosmetics) : [];
  const myFriendCode = await getOrCreateFriendCode(user!.id);
  const myDisplayName = getDisplayName(user!);

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

        <div className="flex flex-col gap-6 lg:flex-row">
          <div className="flex min-w-0 flex-1 flex-col gap-6">
            <StorePlusPromo catalog={catalog} points={user!.points} unlockedCosmetics={unlockedCosmetics} />
            {children}
          </div>

          <div className="shrink-0 lg:w-72">
            <div className="lg:sticky lg:top-24">
              <StoreProfilePreview
                displayName={myDisplayName}
                avatarDataUrl={user!.avatarDataUrl}
                bannerDataUrl={user!.bannerDataUrl}
                friendCode={myFriendCode}
                equippedFrame={user!.equippedFrame}
                equippedBadge={user!.equippedBadge}
                equippedBanner={user!.equippedBanner}
                nameEffect={user!.nameEffect}
                nameEffectColor1={user!.nameEffectColor1}
                nameEffectColor2={user!.nameEffectColor2}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
