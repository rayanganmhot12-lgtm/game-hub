import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { prisma } from "@/lib/prisma";
import SendPointsPanel from "@/components/SendPointsPanel";
import WithdrawPointsPanel from "@/components/WithdrawPointsPanel";
import GiftCosmeticPanel from "@/components/GiftCosmeticPanel";
import RevokeCosmeticPanel from "@/components/RevokeCosmeticPanel";
import DevCheatsPanel from "@/components/DevCheatsPanel";

export default async function ModerationStorePage() {
  const user = await getCurrentUser();

  const friends = await prisma.friend.findMany({ where: { userId: user!.id }, orderBy: { friendDisplayName: "asc" } });
  const myCode = await getOrCreateFriendCode(user!.id);
  const myDisplayName = getDisplayName(user!);

  return (
    <div className="flex flex-col gap-4">
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
      <div className="border-t border-border/40 pt-4">
        <RevokeCosmeticPanel myCode={myCode} myDisplayName={myDisplayName} friends={friends} />
      </div>
    </div>
  );
}
