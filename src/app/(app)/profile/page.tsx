import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { PLUS_ITEM_ID } from "@/lib/cosmetics";
import ProfileManager from "@/components/ProfileManager";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }
  const hasPlus = user.unlockedCosmetics ? (JSON.parse(user.unlockedCosmetics) as string[]).includes(PLUS_ITEM_ID) : false;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="text-sm text-muted">Your photo and username, shown across Friends, Chat, and Groups.</p>
      </div>
      <ProfileManager
        initialDisplayName={getDisplayName(user)}
        initialAvatarDataUrl={user.avatarDataUrl}
        initialBannerDataUrl={user.bannerDataUrl}
        initialBio={user.bio}
        initialPronouns={user.pronouns}
        initialProfileNote={user.profileNote}
        initialAccentColor={user.accentColor}
        equippedFrame={user.equippedFrame}
        equippedBanner={user.equippedBanner}
        hasPlus={hasPlus}
      />
    </div>
  );
}
