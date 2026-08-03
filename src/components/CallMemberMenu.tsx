"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ProfileAvatar from "@/components/ProfileAvatar";
import PeerAudioControls from "@/components/PeerAudioControls";

export interface CallMemberMenuTarget {
  code: string;
  displayName: string;
  x: number;
  y: number;
}

const MENU_WIDTH = 232;
const MENU_HEIGHT = 176;

// Right-clicking someone in a call. Deliberately narrower than
// MemberContextMenu, which is the member list's menu and carries roles,
// nicknames and mentions — none of which belong on a video tile, and half of
// which need a server this menu is not necessarily inside.
export default function CallMemberMenu({
  target,
  onClose,
}: {
  target: CallMemberMenuTarget;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [onClose]);

  // Kept inside the viewport, or a right-click near the bottom or right edge
  // opens a menu half of which cannot be reached.
  const left = Math.max(8, Math.min(target.x, window.innerWidth - MENU_WIDTH - 8));
  const top = Math.max(8, Math.min(target.y, window.innerHeight - MENU_HEIGHT - 8));

  return (
    <AnimatePresence>
      <motion.div
        ref={menuRef}
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.12 }}
        style={{ left, top, width: MENU_WIDTH }}
        className="panel fixed z-[95] origin-top-left p-1.5"
      >
        <div className="flex items-center gap-2 px-2.5 py-2">
          <ProfileAvatar code={target.code} displayName={target.displayName} size={28} />
          <span className="truncate text-sm font-medium text-foreground">{target.displayName}</span>
        </div>
        <div className="my-1 h-px bg-border/60" />
        <PeerAudioControls code={target.code} />
      </motion.div>
    </AnimatePresence>
  );
}
