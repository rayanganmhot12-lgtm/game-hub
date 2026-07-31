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
    <div className="flex items-center gap-1.5 border-t border-border/60 bg-surface-2/40 px-2 py-2.5">
      <Link
        href="/profile"
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 transition-colors hover:bg-surface-2/60"
        title="Edit profile"
      >
        <CosmeticFrame frameId={equippedFrame}>
          {avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img src={avatarDataUrl} alt={displayName} width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="icon-badge h-8 w-8">
              <User size={14} />
            </div>
          )}
        </CosmeticFrame>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          <p className="truncate text-[11px] text-muted">{formatFriendCode(friendCode)}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1">
        <CosmeticBadge badgeId={equippedBadge} />
        <Link href="/profile" className="btn-ghost !p-1.5" title="Profile settings">
          <Settings size={15} />
        </Link>
      </div>
    </div>
  );
}
