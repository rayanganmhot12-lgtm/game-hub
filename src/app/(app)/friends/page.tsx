import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { prisma } from "@/lib/prisma";
import FriendsHub from "@/components/FriendsHub";
import PageHeader from "@/components/PageHeader";

export default async function FriendsPage() {
  const user = await getCurrentUser();
  const myCode = await getOrCreateFriendCode(user!.id);
  const myDisplayName = getDisplayName(user!);

  const [friends, groups] = await Promise.all([
    prisma.friend.findMany({
      where: { userId: user!.id },
      orderBy: { friendDisplayName: "asc" },
    }),
    prisma.group.findMany({
      where: { userId: user!.id },
      include: { members: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <PageHeader
          title="Friends"
          subtitle="Friends, groups, and servers — add by code, chat, call, or join with an invite."
        />
      </div>

      <FriendsHub
        myCode={myCode}
        myDisplayName={myDisplayName}
        myBadge={user!.equippedBadge}
        initialFriends={friends}
        initialGroups={groups}
      />
    </div>
  );
}
