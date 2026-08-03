import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { isAdminEmail } from "@/lib/admin";
import { getPricedCatalog } from "@/lib/storePricesServer";
import StoreSidebar from "@/components/StoreSidebar";
import StorePlusPromo from "@/components/StorePlusPromo";
import StoreProfilePreview from "@/components/StoreProfilePreview";
import PageHeader from "@/components/PageHeader";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Layouts render in parallel with the page, so the app-level layout's own
  // redirect can't be relied on to run first — without this guard a stale or
  // expired session dereferences null here and the whole route 500s.
  if (!user) {
    redirect("/");
  }
  const isDev = isAdminEmail(user.email);
  const priced = getPricedCatalog();
  const catalog = isDev ? priced : priced.filter((c) => !c.adminOnly);
  const unlockedCosmetics: string[] = user.unlockedCosmetics ? JSON.parse(user.unlockedCosmetics) : [];
  const myFriendCode = await getOrCreateFriendCode(user.id);
  const myDisplayName = getDisplayName(user);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Section navigation only. The profile card that used to sit under it
          was a second copy of the one the app column already carries. */}
      <div className="flex shrink-0 flex-col md:w-52">
        <StoreSidebar catalog={catalog} unlockedCosmetics={unlockedCosmetics} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <PageHeader
          title="Store"
          subtitle="Cosmetic profile flair, unlocked with points earned from actually using Game Hub — playing games, unlocking achievements, and syncing. No real money involved."
        />

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
