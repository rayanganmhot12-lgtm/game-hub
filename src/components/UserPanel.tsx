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
  nameEffect,
}: {
  displayName: string;
  avatarDataUrl: string | null;
  friendCode: string;
  equippedFrame: string | null;
  equippedBadge: string | null;
  nameEffect: string | null;
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border/60 bg-surface-2/40 px-3 py-3">
      <Link
        href="/profile"
        className="flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-surface-2/60"
        title="Edit profile"
      >
        <CosmeticFrame frameId={equippedFrame}>
          {avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img
              src={avatarDataUrl}
              alt={displayName}
              width={48}
              height={48}
              className="h-12 w-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="icon-badge h-12 w-12 shrink-0">
              <User size={20} />
            </div>
          )}
        </CosmeticFrame>
        <div className="min-w-0">
          <p
            className={`truncate text-base font-medium ${
              nameEffect === "gradient-cycle" ? "name-gradient-cycle" : "text-foreground"
            }`}
          >
            {displayName}
          </p>
          <p className="truncate text-xs text-muted">{formatFriendCode(friendCode)}</p>
        </div>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">
        <CosmeticBadge badgeId={equippedBadge} />
        <Link href="/profile" className="btn-ghost !p-2" title="Profile settings">
          <Settings size={20} />
        </Link>
      </div>
    </div>
  );
}
