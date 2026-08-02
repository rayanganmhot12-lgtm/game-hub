import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";
import { isAdminEmail } from "@/lib/admin";
import { ensureDevBadge } from "@/lib/devBadge";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import ServerRail from "@/components/ServerRail";
import PageTransition from "@/components/PageTransition";
import MusicPlayerBar from "@/components/MusicPlayerBar";
import AutoSync from "@/components/AutoSync";
import PresenceHeartbeat from "@/components/PresenceHeartbeat";
import WarningOverlay from "@/components/WarningOverlay";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import CallWindow from "@/components/CallWindow";
import IncomingCallBanner from "@/components/IncomingCallBanner";
import PointsGiftListener from "@/components/PointsGiftListener";
import PointsWithdrawalListener from "@/components/PointsWithdrawalListener";
import CosmeticGiftListener from "@/components/CosmeticGiftListener";
import GroupMessageNotifier from "@/components/GroupMessageNotifier";
import ProfilePublisher from "@/components/ProfilePublisher";
import { MusicPlayerProvider } from "@/context/MusicPlayerContext";
import { CallProvider } from "@/context/CallContext";
import { GroupCallProvider } from "@/context/GroupCallContext";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }
  const myFriendCode = await getOrCreateFriendCode(user.id);
  const isAdmin = isAdminEmail(user.email);
  const myDisplayName = getDisplayName(user);
  if (isAdmin) {
    await ensureDevBadge(user.id, user.unlockedCosmetics);
  }

  const [servers, friends] = await Promise.all([
    prisma.group.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.friend.findMany({ where: { userId: user.id }, orderBy: { friendDisplayName: "asc" } }),
  ]);

  return (
    <MusicPlayerProvider>
      <CallProvider myCode={myFriendCode} myDisplayName={myDisplayName}>
        <GroupCallProvider myCode={myFriendCode} myDisplayName={myDisplayName}>
          <AutoSync />
          <ProfilePublisher
            myCode={myFriendCode}
            displayName={myDisplayName}
            avatarDataUrl={user.avatarDataUrl}
            bannerDataUrl={user.bannerDataUrl}
            bio={user.bio}
            pronouns={user.pronouns}
            profileNote={user.profileNote}
            badge={user.equippedBadge}
            frame={user.equippedFrame}
            banner={user.equippedBanner}
            accentColor={user.accentColor}
            pinnedCosmeticId={user.pinnedCosmeticId}
            nameEffect={user.nameEffect}
          />
          <PresenceHeartbeat myCode={myFriendCode} />
          <WarningOverlay myCode={myFriendCode} />
          <AnnouncementBanner myCode={myFriendCode} />
          <PointsGiftListener myCode={myFriendCode} />
          <PointsWithdrawalListener myCode={myFriendCode} />
          <CosmeticGiftListener myCode={myFriendCode} />
          <GroupMessageNotifier servers={servers} myCode={myFriendCode} />
          <IncomingCallBanner />
          <CallWindow />
          <div className="flex min-h-screen flex-col">
            <Navbar points={user.points} />
            <div className="flex flex-1">
              <ServerRail
                servers={servers}
                myCode={myFriendCode}
                myDisplayName={myDisplayName}
                myBadge={user.equippedBadge}
                friends={friends}
              />
              <Sidebar
                isAdmin={isAdmin}
                displayName={myDisplayName}
                avatarDataUrl={user.avatarDataUrl}
                friendCode={myFriendCode}
                equippedFrame={user.equippedFrame}
                equippedBadge={user.equippedBadge}
                nameEffect={user.nameEffect}
              />
              <main className="flex-1 p-4 pb-24 md:p-6 md:pb-24">
                <PageTransition>{children}</PageTransition>
              </main>
            </div>
            <MusicPlayerBar />
          </div>
        </GroupCallProvider>
      </CallProvider>
    </MusicPlayerProvider>
  );
}
