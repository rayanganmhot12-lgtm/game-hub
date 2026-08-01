"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";
import { useCall } from "@/context/CallContext";
import { useToast } from "@/context/ToastContext";
import { useSound } from "@/context/SoundContext";

const STATUS_LABEL: Record<string, string> = {
  "ringing-out": "Ringing…",
  "ringing-in": "Incoming call",
};

export default function IncomingCallBanner() {
  const { incomingCall, activeCall, acceptCall, declineCall, hangUp } = useCall();
  const { showToast } = useToast();
  const { playRingtone } = useSound();
  const [busy, setBusy] = useState(false);

  const isRinging = (Boolean(incomingCall) && !activeCall) || activeCall?.status === "ringing-out";

  useEffect(() => {
    if (!isRinging) return;
    const stopRingtone = playRingtone();
    return stopRingtone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRinging]);

  async function handleAccept() {
    setBusy(true);
    try {
      await acceptCall();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't accept call.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {incomingCall && !activeCall ? (
        <motion.div
          key="incoming"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(360px,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-black">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent-bright/50" />
            <Phone size={18} className="relative" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{incomingCall.fromDisplayName}</p>
            <p className="text-xs text-muted">Incoming voice call…</p>
          </div>
          <button
            onClick={declineCall}
            disabled={busy}
            title="Decline"
            className="rounded-full bg-red-500/15 p-2.5 text-red-400 transition-transform duration-100 hover:bg-red-500/25 active:scale-90"
          >
            <PhoneOff size={16} />
          </button>
          <button
            onClick={handleAccept}
            disabled={busy}
            title="Accept"
            className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-400 transition-transform duration-100 hover:bg-emerald-500/25 active:scale-90"
          >
            <Phone size={16} />
          </button>
        </motion.div>
      ) : activeCall?.status === "ringing-out" ? (
        <motion.div
          key="ringing-out"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(360px,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-black">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent-bright/50" />
            <Phone size={18} className="relative" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{activeCall.peerDisplayName}</p>
            <p className="text-xs text-muted">{STATUS_LABEL["ringing-out"]}</p>
          </div>
          <button
            onClick={hangUp}
            title="Cancel"
            className="rounded-full bg-red-500/15 p-2.5 text-red-400 transition-transform duration-100 hover:bg-red-500/25 active:scale-90"
          >
            <PhoneOff size={16} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
