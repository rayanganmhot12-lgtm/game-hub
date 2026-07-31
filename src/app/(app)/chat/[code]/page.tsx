import Link from "next/link";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { prisma } from "@/lib/prisma";
import { normalizeFriendCode } from "@/lib/friendCode";
import EmptyState from "@/components/EmptyState";
import ChatWindow from "@/components/ChatWindow";

export default async function ChatPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  const { code } = await params;
  const peerFriendCode = normalizeFriendCode(code);

  const myCode = await getOrCreateFriendCode(user!.id);
  const friend = await prisma.friend.findUnique({
    where: { userId_friendCode: { userId: user!.id, friendCode: peerFriendCode } },
  });

  if (!friend) {
    return (
      <div className="flex flex-col gap-4">
        <Link href="/friends" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={16} />
          Back to Friends
        </Link>
        <EmptyState icon={MessageCircle} title="Not a friend">
          Add them as a friend first from the Friends page.
        </EmptyState>
      </div>
    );
  }

  const messages = await prisma.chatMessage.findMany({
    where: { userId: user!.id, peerFriendCode },
    orderBy: { sentAt: "asc" },
  });

  const myDisplayName = getDisplayName(user!);

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-2xl flex-col gap-3">
      <Link href="/friends" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} />
        Back to Friends
      </Link>
      <ChatWindow
        myCode={myCode}
        myDisplayName={myDisplayName}
        peerCode={friend.friendCode}
        peerDisplayName={friend.friendDisplayName}
        peerBadge={friend.friendBadge}
        initialMessages={messages}
      />
    </div>
  );
}
