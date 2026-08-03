"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  listenForAnnouncements,
  listenForGlobalAnnouncements,
  removeAnnouncement,
} from "@/lib/announcementRealtime";
import { hasSeenAnnouncement, markAnnouncementSeen } from "@/lib/seenAnnouncements";
import { logNotification } from "@/lib/notifications";
import { useSound } from "@/context/SoundContext";
import AnnouncementCard from "@/components/AnnouncementCard";

// A fixed five seconds was fine for a message truncated to one line and wrong
// for the whole thing: a two-word notice does not need fifteen seconds, and a
// paragraph cannot be read in five. Roughly 240 words per minute, with a floor
// that covers noticing it at all and a ceiling so nothing camps on the screen.
const BASE_MS = 8000;
const MS_PER_WORD = 250;
const MAX_MS = 30000;
const TICK_MS = 100;

export function dismissDurationMs(message: string): number {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(BASE_MS + words * MS_PER_WORD, MAX_MS);
}

interface QueuedAnnouncement {
  id: string;
  message: string;
  fromDisplayName: string;
  // Decides what dismissal means: a targeted node belongs to one recipient and
  // is deleted, a broadcast is shared and can only be remembered locally.
  kind: "targeted" | "global";
}

export default function AnnouncementBanner({ myCode }: { myCode: string }) {
  const [queue, setQueue] = useState<QueuedAnnouncement[]>([]);
  const [progress, setProgress] = useState(1);
  const { playAnnouncement } = useSound();

  const current = queue[0] ?? null;

  // Read by the ticker, which must not be rebuilt every time either changes.
  const pausedRef = useRef(false);
  const dismissRef = useRef<() => void>(() => {});

  useEffect(() => {
    function enqueue(item: QueuedAnnouncement) {
      // Announcements used to overwrite each other — two arriving close
      // together meant the first was gone before it could be read. They wait
      // their turn now.
      setQueue((prev) => (prev.some((q) => q.id === item.id) ? prev : [...prev, item]));
      logNotification("announcement", `${item.fromDisplayName}: ${item.message}`);
      playAnnouncement();
    }

    const unsubTargeted = listenForAnnouncements(myCode, (a, id) =>
      enqueue({ id, message: a.message, fromDisplayName: a.fromDisplayName, kind: "targeted" })
    );
    const unsubGlobal = listenForGlobalAnnouncements((a, id) => {
      // The sender gets their own broadcast too. Skipping it seemed obvious —
      // you know what you sent — but it left no way to see what everyone else
      // was actually shown, which is the thing you most want to check right
      // after sending it.
      if (hasSeenAnnouncement(id)) return;
      enqueue({ id, message: a.message, fromDisplayName: a.fromDisplayName, kind: "global" });
    });

    return () => {
      unsubTargeted();
      unsubGlobal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  const dismiss = useCallback(() => {
    if (!current) return;
    if (current.kind === "targeted") removeAnnouncement(myCode, current.id);
    else markAnnouncementSeen(current.id);
    setQueue((prev) => prev.filter((q) => q.id !== current.id));
  }, [current, myCode]);

  useEffect(() => {
    dismissRef.current = dismiss;
  }, [dismiss]);

  // Keyed on the announcement, so each one gets its own full countdown rather
  // than inheriting whatever was left of the last one's.
  useEffect(() => {
    if (!current) return;
    const duration = dismissDurationMs(current.message);
    let elapsed = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(1);
    const interval = setInterval(() => {
      if (pausedRef.current) return;
      elapsed += TICK_MS;
      const remaining = Math.max(0, 1 - elapsed / duration);
      setProgress(remaining);
      if (remaining === 0) dismissRef.current();
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [current?.id, current?.message, current]);

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          className="fixed inset-x-0 top-0 z-[90] mx-auto w-[min(720px,calc(100%-2rem))]"
        >
          <AnnouncementCard
            message={current.message}
            fromDisplayName={current.fromDisplayName}
            queueLabel={queue.length > 1 ? `1 of ${queue.length}` : undefined}
            progress={progress}
            onDismiss={dismiss}
            // Reading it should not be a race against its own timer.
            onPointerEnter={() => (pausedRef.current = true)}
            onPointerLeave={() => (pausedRef.current = false)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
