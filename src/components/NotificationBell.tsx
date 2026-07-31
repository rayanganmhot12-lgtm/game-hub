"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Trash2, Gift, Sparkles, UserPlus, Users2, AlertTriangle, Megaphone, UserCheck, MessageSquare, AtSign } from "lucide-react";

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string | Date;
}

const TYPE_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  friend_request: UserPlus,
  friend_accept: UserCheck,
  group_invite: Users2,
  group_message: MessageSquare,
  group_mention: AtSign,
  points_gift: Gift,
  cosmetic_gift: Sparkles,
  warning: AlertTriangle,
  announcement: Megaphone,
};

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const { notifications: fresh } = await res.json();
      setNotifications(fresh);
    }
    setLoaded(true);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  }

  async function handleClearAll() {
    await fetch("/api/notifications", { method: "DELETE" });
    setNotifications([]);
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative" ref={containerRef}>
      <button onClick={handleToggle} className="btn-ghost relative !px-2.5" title="Notifications">
        <Bell size={15} />
        {loaded && unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <span className="text-sm font-semibold text-foreground">Notifications</span>
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-red-400"
                >
                  <Trash2 size={12} />
                  Clear
                </button>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="p-6 text-center text-xs text-muted">Nothing yet — you&apos;re all caught up.</p>
              ) : (
                notifications.map((n) => {
                  const Icon = TYPE_ICONS[n.type] ?? Bell;
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-2.5 border-b border-border/60 px-4 py-3 last:border-b-0 ${
                        n.read ? "" : "bg-accent/5"
                      }`}
                    >
                      <span className="icon-badge mt-0.5 h-7 w-7 shrink-0">
                        <Icon size={13} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-foreground">{n.message}</p>
                        <p className="mt-0.5 text-[10px] text-muted">{timeAgo(new Date(n.createdAt))}</p>
                      </div>
                      {!n.read && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright" />}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
