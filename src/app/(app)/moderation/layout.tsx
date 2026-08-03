import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { isAdminEmail } from "@/lib/admin";
import ModerationSidebar from "@/components/ModerationSidebar";
import SidebarProfilePanel from "@/components/SidebarProfilePanel";
import PageHeader from "@/components/PageHeader";

export default async function ModerationLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect("/dashboard");
  }
  const myFriendCode = await getOrCreateFriendCode(user.id);
  const myDisplayName = getDisplayName(user);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <div className="flex shrink-0 flex-col md:w-52">
        <ModerationSidebar />
        <SidebarProfilePanel
          displayName={myDisplayName}
          avatarDataUrl={user.avatarDataUrl}
          friendCode={myFriendCode}
          equippedFrame={user.equippedFrame}
          equippedBadge={user.equippedBadge}
          nameEffect={user.nameEffect}
          nameEffectColor1={user.nameEffectColor1}
          nameEffectColor2={user.nameEffectColor2}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <PageHeader title="Moderation" subtitle="Warn, mute, timeout, or ban a user by their friend code." />
        {children}
      </div>
    </div>
  );
}
