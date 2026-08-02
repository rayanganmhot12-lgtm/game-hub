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
  const catalog = isDev ? COSMETIC_CATALOG : COSMETIC_CATALOG.filter((c) => !c.adminOnly);
  const unlockedCosmetics: string[] = user!.unlockedCosmetics ? JSON.parse(user!.unlockedCosmetics) : [];

  return (
    <div className="flex flex-col gap-6">
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
        type="frame"
        catalog={catalog}
        points={user!.points}
        unlockedCosmetics={unlockedCosmetics}
        equippedFrame={user!.equippedFrame}
        equippedBadge={user!.equippedBadge}
        equippedBanner={user!.equippedBanner}
      />
    </div>
  );
}
