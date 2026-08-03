import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { prisma } from "@/lib/prisma";
import ModerationPanel from "@/components/ModerationPanel";

export default async function ModerationActionsPage() {
  const user = await getCurrentUser();

  // The friends list used to be loaded here to fan an announcement out one
  // copy per friend. Broadcasts are one write to a channel everyone reads, so
  // nothing on this page needs it any more.
  const actions = await prisma.moderationAction.findMany({
    where: { adminUserId: user!.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const myDisplayName = getDisplayName(user!);
  // A broadcast carries its sender's code so recipients can skip their own.
  const myCode = await getOrCreateFriendCode(user!.id);

  return <ModerationPanel myCode={myCode} myDisplayName={myDisplayName} initialActions={actions} />;
}
