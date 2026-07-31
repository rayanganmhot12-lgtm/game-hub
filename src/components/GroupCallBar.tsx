"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Users } from "lucide-react";
import { useGroupCall } from "@/context/GroupCallContext";
import { useToast } from "@/context/ToastContext";

export default function GroupCallBar() {
  const { activeGroupCall, peers, muted, leaveGroupCall, toggleMuted } = useGroupCall();

  return (
    <AnimatePresence>
      {activeGroupCall && (
        <motion.div
          key="group-call"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(420px,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-black">
            <Users size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{activeGroupCall.groupName}</p>
            <p className="truncate text-xs text-muted">
              {peers.length === 0
                ? "Waiting for others to join…"
                : `${peers.length} other${peers.length === 1 ? "" : "s"}: ${peers.map((p) => p.displayName).join(", ")}`}
            </p>
          </div>
          <button
            onClick={toggleMuted}
            title={muted ? "Unmute" : "Mute"}
            className={`rounded-full p-2.5 transition-transform duration-100 active:scale-90 ${
              muted ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            onClick={leaveGroupCall}
            title="Leave voice"
            className="rounded-full bg-red-500/15 p-2.5 text-red-400 transition-transform duration-100 hover:bg-red-500/25 active:scale-90"
          >
            <PhoneOff size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function JoinVoiceButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const { activeGroupCall, joinGroupCall } = useGroupCall();
  const { showToast } = useToast();
  const [joining, setJoining] = useState(false);
  const isThisGroup = activeGroupCall?.groupId === groupId;

  if (isThisGroup) return null;

  async function handleJoin() {
    setJoining(true);
    try {
      await joinGroupCall(groupId, groupName);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't join voice.", "error");
    } finally {
      setJoining(false);
    }
  }

  return (
    <button
      onClick={handleJoin}
      disabled={joining || Boolean(activeGroupCall)}
      title={activeGroupCall ? "Leave your current voice call first" : "Join voice"}
      className="btn-ghost !px-3 !py-1.5 !text-xs"
    >
      <Phone size={13} />
      Join Voice
    </button>
  );
}
