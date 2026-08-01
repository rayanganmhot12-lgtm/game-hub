import Link from "next/link";
import { Settings, User } from "lucide-react";
import { CosmeticFrame, CosmeticBadge } from "@/components/CosmeticFrame";
import { formatFriendCode } from "@/lib/friendCode";

export default function UserPanel({
  displayName,
  avatarDataUrl,
  friendCode,
  equippedFrame,
  equippedBadge,
}: {
  displayName: string;
  avatarDataUrl: string | null;
  friendCode: string;
  equippedFrame: string | null;
  equippedBadge: string | null;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-border/60 bg-surface-2/40 px-3 py-4">
      <Link
        href="/profile"
        className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2 transition-colors hover:bg-surface-2/60"
        title="Edit profile"
      >
        <CosmeticFrame frameId={equippedFrame}>
          {avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img
              src={avatarDataUrl}
              alt={displayName}
              width={64}
              height={64}
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="icon-badge h-16 w-16 shrink-0">
              <User size={28} />
            </div>
          )}
        </CosmeticFrame>
        <div className="min-w-0">
          <p className="truncate text-xl font-medium text-foreground">{displayName}</p>
          <p className="truncate text-sm text-muted">{formatFriendCode(friendCode)}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <CosmeticBadge badgeId={equippedBadge} />
        <Link href="/profile" className="btn-ghost !p-2.5" title="Profile settings">
          <Settings size={26} />
        </Link>
      </div>
    </div>
  );
}
