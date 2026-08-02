import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ModerationPanel from "@/components/ModerationPanel";

export default async function ModerationActionsPage() {
  const user = await getCurrentUser();

  const [actions, friends] = await Promise.all([
    prisma.moderationAction.findMany({
      where: { adminUserId: user!.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.friend.findMany({ where: { userId: user!.id }, orderBy: { friendDisplayName: "asc" } }),
  ]);

  const myDisplayName = getDisplayName(user!);

  return <ModerationPanel myDisplayName={myDisplayName} initialActions={actions} friends={friends} />;
}
