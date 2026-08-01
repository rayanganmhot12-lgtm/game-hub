import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { COSMETIC_CATALOG } from "@/lib/cosmetics";
import { Wrench } from "lucide-react";
import StoreGrid from "@/components/StoreGrid";
import SendPointsPanel from "@/components/SendPointsPanel";
import WithdrawPointsPanel from "@/components/WithdrawPointsPanel";
import GiftCosmeticPanel from "@/components/GiftCosmeticPanel";
import DevCheatsPanel from "@/components/DevCheatsPanel";
import CollapsibleSection from "@/components/CollapsibleSection";

export default async function StorePage() {
  const user = await getCurrentUser();
  const isDev = isAdminEmail(user!.email);

  const friends = isDev
    ? await prisma.friend.findMany({ where: { userId: user!.id }, orderBy: { friendDisplayName: "asc" } })
    : [];
  const myCode = isDev ? await getOrCreateFriendCode(user!.id) : "";
  const myDisplayName = isDev ? getDisplayName(user!) : "";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Store</h1>
        <p className="text-sm text-muted">
          Cosmetic profile flair, unlocked with points earned from actually using Game Hub — playing games,
          unlocking achievements, and syncing. No real money involved.
        </p>
      </div>

      {isDev && (
        <CollapsibleSection
          title="Developer Tools"
          description="Cheats, points, and gifting — only visible to you"
          icon={<Wrench size={16} className="text-accent-bright" />}
        >
          <DevCheatsPanel />
          <div className="border-t border-border/40 pt-4">
            <SendPointsPanel myCode={myCode} myDisplayName={myDisplayName} friends={friends} />
          </div>
          <div className="border-t border-border/40 pt-4">
            <WithdrawPointsPanel myCode={myCode} myDisplayName={myDisplayName} friends={friends} />
          </div>
          <div className="border-t border-border/40 pt-4">
            <GiftCosmeticPanel myCode={myCode} myDisplayName={myDisplayName} friends={friends} />
          </div>
        </CollapsibleSection>
      )}

      <StoreGrid
        catalog={isDev ? COSMETIC_CATALOG : COSMETIC_CATALOG.filter((c) => !c.adminOnly)}
        points={user!.points}
        unlockedCosmetics={user!.unlockedCosmetics ? JSON.parse(user!.unlockedCosmetics) : []}
        equippedFrame={user!.equippedFrame}
        equippedBadge={user!.equippedBadge}
        equippedBanner={user!.equippedBanner}
      />
    </div>
  );
}
