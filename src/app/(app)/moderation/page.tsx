import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import ModerationTabs from "@/components/ModerationTabs";

export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  const [actions, friends] = await Promise.all([
    prisma.moderationAction.findMany({
      where: { adminUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.friend.findMany({ where: { userId: user.id }, orderBy: { friendDisplayName: "asc" } }),
  ]);

  const myDisplayName = getDisplayName(user);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Moderation</h1>
        <p className="text-sm text-muted">Warn, mute, timeout, or ban a user by their friend code.</p>
      </div>
      <ModerationTabs
        myDisplayName={myDisplayName}
        initialActions={actions}
        friends={friends}
        initialNameEffect={user.nameEffect}
        initialColor1={user.nameEffectColor1}
        initialColor2={user.nameEffectColor2}
      />
    </div>
  );
}
