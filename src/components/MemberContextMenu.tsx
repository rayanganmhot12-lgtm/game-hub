"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { User, AtSign, Volume2, VolumeX, UserCog, ChevronRight, Check } from "lucide-react";
import { useGroupCall } from "@/context/GroupCallContext";
import { setMemberRole, type GroupRole } from "@/lib/groupRealtime";
import { RoleChip } from "@/components/ServerModerationTabs";
import type { GroupMemberEntry } from "@/components/ServerChips";

export interface MemberContextMenuTarget {
  member: GroupMemberEntry;
  x: number;
  y: number;
}

// A Discord-style right-click menu for a member — shows a reduced set of
// options on your own row (no Mention/Mute — those only make sense aimed at
// someone else) and gates renaming someone ELSE's nickname to the server's
// creator, since there's no separate moderator flag to check instead.
export default function MemberContextMenu({
  target,
  groupId,
  myCode,
  creatorCode,
  roles,
  onClose,
  onViewProfile,
  onMention,
  onEditNickname,
}: {
  target: MemberContextMenuTarget;
  groupId: string;
  myCode: string;
  creatorCode: string | null;
  roles: Array<GroupRole & { id: string }>;
  onClose: () => void;
  onViewProfile: (member: GroupMemberEntry) => void;
  onMention: (member: GroupMemberEntry) => void;
  onEditNickname: (member: GroupMemberEntry) => void;
}) {
  const { locallyMutedPeers, toggleLocalMute } = useGroupCall();
  const [rolesOpen, setRolesOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  const { member } = target;
  const isSelf = member.code === myCode;
  const canEditOthersNickname = myCode === creatorCode;
  const isLocallyMuted = locallyMutedPeers.has(member.code);

  const left = Math.min(target.x, window.innerWidth - 220);
  const top = Math.min(target.y, window.innerHeight - 320);

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.12 }}
        style={{ left, top }}
        className="fixed z-[100] w-52 overflow-hidden rounded-lg border border-border bg-surface py-1.5 shadow-2xl"
      >
        <button
          onClick={() => {
            onViewProfile(member);
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
        >
          <User size={13} />
          Profile
        </button>

        {!isSelf && (
          <button
            onClick={() => {
              onMention(member);
              onClose();
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
          >
            <AtSign size={13} />
            Mention
          </button>
        )}

        {!isSelf && (
          <>
            <div className="my-1 border-t border-border/60" />
            <button
              onClick={() => toggleLocalMute(member.code)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              <span className="flex items-center gap-2">
                {isLocallyMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
                Mute
              </span>
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border ${
                  isLocallyMuted ? "border-accent-bright bg-accent-bright text-black" : "border-muted"
                }`}
              >
                {isLocallyMuted && <Check size={10} />}
              </span>
            </button>
          </>
        )}

        {(isSelf || canEditOthersNickname) && (
          <>
            <div className="my-1 border-t border-border/60" />
            <button
              onClick={() => {
                onEditNickname(member);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              <UserCog size={13} />
              Edit Per-server Profile
            </button>
          </>
        )}

        {roles.length > 0 && (
          <>
            <div className="my-1 border-t border-border/60" />
            <button
              onClick={() => setRolesOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              Roles
              <ChevronRight size={13} className={`transition-transform ${rolesOpen ? "rotate-90" : ""}`} />
            </button>
            {rolesOpen && (
              <div className="border-t border-border/60 bg-surface-2/30 py-1">
                <button
                  onClick={async () => {
                    await setMemberRole(groupId, member.code, null).catch(() => {});
                    onClose();
                  }}
                  className="flex w-full items-center px-4 py-1.5 text-left text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  No role
                </button>
                {roles.map((r) => (
                  <button
                    key={r.id}
                    onClick={async () => {
                      await setMemberRole(groupId, member.code, r.id).catch(() => {});
                      onClose();
                    }}
                    className="flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs transition-colors hover:bg-surface-2"
                  >
                    <RoleChip role={r} />
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
