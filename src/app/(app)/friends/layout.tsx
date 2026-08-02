import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { isAdminEmail } from "@/lib/admin";
import FriendsSidebar from "@/components/FriendsSidebar";

export default async function FriendsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }
  const myFriendCode = await getOrCreateFriendCode(user.id);
  const myDisplayName = getDisplayName(user);
  const isAdmin = isAdminEmail(user.email);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <FriendsSidebar
        isAdmin={isAdmin}
        displayName={myDisplayName}
        avatarDataUrl={user.avatarDataUrl}
        friendCode={myFriendCode}
        equippedFrame={user.equippedFrame}
        equippedBadge={user.equippedBadge}
        nameEffect={user.nameEffect}
        nameEffectColor1={user.nameEffectColor1}
        nameEffectColor2={user.nameEffectColor2}
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
