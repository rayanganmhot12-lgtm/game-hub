import Link from "next/link";
import { User, Settings } from "lucide-react";
import { CosmeticFrame, CosmeticBadge } from "@/components/CosmeticFrame";
import { formatFriendCode } from "@/lib/friendCode";

// The card pinned to the bottom of every sub-navigation column. It started out
// inline in FriendsSidebar, which is why Store and Moderation had no profile
// card at all and their columns just ended in empty space — pulling it out
// here is what lets all three end the same way. Deliberately not a client
// component: FriendsSidebar is one and can use it, but the Store and
// Moderation layouts are server components and render it directly.
export default function SidebarProfilePanel({
  displayName,
  avatarDataUrl,
  friendCode,
  equippedFrame,
  equippedBadge,
  nameEffect,
  nameEffectColor1,
  nameEffectColor2,
}: {
  displayName: string;
  avatarDataUrl: string | null;
  friendCode: string;
  equippedFrame: string | null;
  equippedBadge: string | null;
  nameEffect: string | null;
  nameEffectColor1: string | null;
  nameEffectColor2: string | null;
}) {
  const nameIsGradient = nameEffect === "gradient-cycle";
  const nameGradientStyle =
    nameIsGradient && nameEffectColor1 && nameEffectColor2
      ? ({ "--name-color-1": nameEffectColor1, "--name-color-2": nameEffectColor2 } as React.CSSProperties)
      : undefined;

  return (
    // mt-auto drops it to the end of the column, and sticky bottom keeps it on
    // screen from there: on a long page like the Store the column runs past the
    // fold, and without this the card sat below it — present but never seen.
    <div className="mt-auto hidden items-center gap-2 rounded-lg border border-border/60 bg-surface-2/40 px-2 py-2 md:sticky md:bottom-4 md:flex">
      <Link
        href="/profile"
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-2/60"
        title="Edit profile"
      >
        <CosmeticFrame frameId={equippedFrame}>
          {avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img
              src={avatarDataUrl}
              alt={displayName}
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="icon-badge h-9 w-9 shrink-0">
              <User size={16} />
            </div>
          )}
        </CosmeticFrame>
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${nameIsGradient ? "name-gradient-cycle" : "text-foreground"}`}
            style={nameGradientStyle}
          >
            {displayName}
          </p>
          <p className="truncate text-[11px] text-muted">{formatFriendCode(friendCode)}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <CosmeticBadge badgeId={equippedBadge} />
        <Link
          href="/profile"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Profile settings"
        >
          <Settings size={16} />
        </Link>
      </div>
    </div>
  );
}
