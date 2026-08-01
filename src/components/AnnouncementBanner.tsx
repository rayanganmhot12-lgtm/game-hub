"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, X } from "lucide-react";
import { listenForAnnouncements, removeAnnouncement, type AnnouncementPayload } from "@/lib/announcementRealtime";
import { logNotification } from "@/lib/notifications";
import { useSound } from "@/context/SoundContext";

const AUTO_DISMISS_SECONDS = 5;

// Keyed by announcement id from the parent, so a new announcement gets a
// fresh mount (and a fresh 5s count) instead of needing an effect to reset
// state. Ticking and the expiry callback are two separate effects — calling
// onExpire() (which sets state on the PARENT AnnouncementBanner) from inside
// this component's own setSecondsLeft updater would fire while React is
// still rendering, which is exactly the "Cannot update a component while
// rendering a different component" error; running it from its own effect,
// after the render that observed secondsLeft === 0, avoids that.
function CountdownBadge({ onExpire }: { onExpire: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(AUTO_DISMISS_SECONDS);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (secondsLeft === 0) onExpire();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-sm font-semibold text-muted">
      {secondsLeft}
    </span>
  );
}

export default function AnnouncementBanner({ myCode }: { myCode: string }) {
  const [announcement, setAnnouncement] = useState<(AnnouncementPayload & { id: string }) | null>(null);
  const { playAnnouncement } = useSound();

  useEffect(() => {
    return listenForAnnouncements(myCode, (a, id) => {
      setAnnouncement({ ...a, id });
      logNotification("announcement", `${a.fromDisplayName}: ${a.message}`);
      playAnnouncement();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  function dismiss() {
    if (!announcement) return;
    removeAnnouncement(myCode, announcement.id);
    setAnnouncement(null);
  }

  return (
    <AnimatePresence>
      {announcement && (
        <motion.div
          key="announcement"
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="fixed inset-x-0 top-0 z-[90] mx-auto flex w-[min(720px,calc(100%-2rem))] items-center gap-4 rounded-b-2xl border border-t-0 border-accent/40 bg-surface/95 px-6 py-5 shadow-2xl backdrop-blur-xl"
        >
          <span className="icon-badge h-14 w-14 shrink-0">
            <Megaphone size={26} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-accent-bright">Announcement from {announcement.fromDisplayName}</p>
            <p className="truncate text-lg font-medium text-foreground">{announcement.message}</p>
          </div>
          <CountdownBadge key={announcement.id} onExpire={dismiss} />
          <button
            onClick={dismiss}
            className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
