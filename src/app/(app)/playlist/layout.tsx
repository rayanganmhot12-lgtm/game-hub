import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { isAdminEmail } from "@/lib/admin";
import FriendsSidebar from "@/components/FriendsSidebar";

// Playlist is reached from FriendsSidebar's second group, but it used to fall
// back to the main app Sidebar — a completely different column that doesn't
// list Playlist at all, so nothing was highlighted and the nav you had just
// clicked from was gone. Rendering the same column here keeps the row you
// clicked visible and marked as the current page.
export default async function PlaylistLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Layouts render in parallel with pages, so this can't lean on the app
  // layout's own redirect having run first.
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
