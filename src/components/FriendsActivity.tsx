import Image from "next/image";
import type { FriendActivity } from "@/lib/steam";

const STATE_LABELS: Record<number, string> = {
  1: "Online",
  2: "Busy",
  3: "Away",
  4: "Snooze",
  5: "Looking to trade",
  6: "Looking to play",
};

export default function FriendsActivity({ friends }: { friends: FriendActivity[] }) {
  if (friends.length === 0) {
    return (
      <p className="text-sm text-muted">
        No friends online right now — or your Steam friends list isn&apos;t set to Public yet (Steam → Settings →
        Privacy Settings → Friends List).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {friends.slice(0, 8).map((friend) => (
        <div
          key={friend.steamId}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-2"
        >
          <div className="relative shrink-0">
            <Image
              src={friend.avatarUrl}
              alt={friend.personaName}
              width={36}
              height={36}
              unoptimized
              className="rounded-full"
            />
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface ${
                friend.gameExtraInfo ? "bg-accent animate-pulse-ring" : "bg-emerald-400"
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{friend.personaName}</p>
            <p className="truncate text-xs text-muted">
              {friend.gameExtraInfo ? `Playing ${friend.gameExtraInfo}` : STATE_LABELS[friend.personaState] ?? "Online"}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
