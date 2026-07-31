"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Megaphone, X } from "lucide-react";
import { listenForAnnouncements, removeAnnouncement, type AnnouncementPayload } from "@/lib/announcementRealtime";
import { logNotification } from "@/lib/notifications";

export default function AnnouncementBanner({ myCode }: { myCode: string }) {
  const [announcement, setAnnouncement] = useState<(AnnouncementPayload & { id: string }) | null>(null);

  useEffect(() => {
    return listenForAnnouncements(myCode, (a, id) => {
      setAnnouncement({ ...a, id });
      logNotification("announcement", `${a.fromDisplayName}: ${a.message}`);
    });
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
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="fixed inset-x-0 top-0 z-[90] mx-auto flex w-[min(560px,calc(100%-2rem))] items-center gap-3 rounded-b-2xl border border-t-0 border-accent/40 bg-surface/95 px-4 py-3 shadow-2xl backdrop-blur-xl"
        >
          <span className="icon-badge h-9 w-9 shrink-0">
            <Megaphone size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-accent-bright">Announcement from {announcement.fromDisplayName}</p>
            <p className="truncate text-sm text-foreground">{announcement.message}</p>
          </div>
          <button
            onClick={dismiss}
            className="shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={15} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
