import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { prisma } from "@/lib/prisma";
import EmptyState from "@/components/EmptyState";
import GroupChatWindow from "@/components/GroupChatWindow";

export default async function GroupChatPage({ params }: { params: Promise<{ groupId: string }> }) {
  const user = await getCurrentUser();
  const { groupId } = await params;

  const myCode = await getOrCreateFriendCode(user!.id);
  const myDisplayName = getDisplayName(user!);

  const group = await prisma.group.findUnique({
    where: { userId_groupId: { userId: user!.id, groupId } },
    include: { members: true },
  });

  if (!group) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/friends" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} />
          Back to Friends
        </Link>
        <EmptyState icon={Users} title="Not a member">
          Join this group first from the Friends page.
        </EmptyState>
      </div>
    );
  }

  const messages = await prisma.groupMessage.findMany({
    where: { groupId: group.id },
    orderBy: { sentAt: "asc" },
  });

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <Link href="/friends" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} />
        Back to Friends
      </Link>
      <GroupChatWindow
        groupId={groupId}
        groupName={group.name}
        myCode={myCode}
        myDisplayName={myDisplayName}
        myBadge={user!.equippedBadge}
        myAvatarDataUrl={user!.avatarDataUrl}
        myEquippedFrame={user!.equippedFrame}
        initialMembers={group.members}
        initialMessages={messages}
      />
    </div>
  );
}
