"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, MicOff, Headphones, HeadphoneOff, Settings, User } from "lucide-react";
import { CosmeticFrame, CosmeticBadge } from "@/components/CosmeticFrame";
import { useGroupCall } from "@/context/GroupCallContext";
import { formatFriendCode } from "@/lib/friendCode";
import FriendProfileModal from "@/components/FriendProfileModal";

// The server view hides the main app sidebar (and with it, the usual
// bottom-left UserPanel) to give channels/chat the room — this is that
// panel's Discord-style equivalent for while you're inside a server.
export default function ServerUserPanel({
  myCode,
  myDisplayName,
  avatarDataUrl,
  equippedFrame,
  equippedBadge,
}: {
  myCode: string;
  myDisplayName: string;
  avatarDataUrl?: string | null;
  equippedFrame?: string | null;
  equippedBadge?: string | null;
}) {
  const { muted, deafened, toggleMuted, toggleDeafen } = useGroupCall();
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="flex items-center gap-1 border-t border-border/60 bg-surface-2/40 px-2 py-2">
      <button
        onClick={() => setShowProfile(true)}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-surface-2/60"
        title="View profile"
      >
        <CosmeticFrame frameId={equippedFrame}>
          {avatarDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img src={avatarDataUrl} alt={myDisplayName} width={28} height={28} className="h-7 w-7 rounded-full object-cover" />
          ) : (
            <div className="icon-badge h-7 w-7">
              <User size={12} />
            </div>
          )}
        </CosmeticFrame>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">{myDisplayName}</p>
          <p className="truncate text-[10px] text-muted">{formatFriendCode(myCode)}</p>
        </div>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          onClick={toggleMuted}
          title={muted ? "Unmute" : "Mute"}
          className={`rounded-lg p-1.5 transition-colors ${
            muted ? "text-red-400 hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          {muted ? <MicOff size={15} /> : <Mic size={15} />}
        </button>
        <button
          onClick={toggleDeafen}
          title={deafened ? "Undeafen" : "Deafen"}
          className={`rounded-lg p-1.5 transition-colors ${
            deafened ? "text-red-400 hover:bg-surface-2" : "text-muted hover:bg-surface-2 hover:text-foreground"
          }`}
        >
          {deafened ? <HeadphoneOff size={15} /> : <Headphones size={15} />}
        </button>
        <CosmeticBadge badgeId={equippedBadge} />
        <Link
          href="/profile"
          className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          title="Profile settings"
        >
          <Settings size={15} />
        </Link>
      </div>

      {showProfile && (
        <FriendProfileModal
          code={myCode}
          fallbackDisplayName={myDisplayName}
          isSelf
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
