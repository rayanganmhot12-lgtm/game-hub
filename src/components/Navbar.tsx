"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Gamepad2, LogOut, RefreshCw, Gem, Tv } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import SoundToggle from "@/components/SoundToggle";
import NotificationBell from "@/components/NotificationBell";
import { useToast } from "@/context/ToastContext";
import { runSync, notifyNewAchievements } from "@/lib/syncClient";

export default function Navbar({ points }: { points: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const results = await runSync();
      const failed = results.filter((r) => !r.ok);
      const newAchievements = results.flatMap((r) => r.newAchievements ?? []);
      const pointsEarned = results.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0);

      if (failed.length > 0) {
        showToast(failed[0].error ?? "Sync failed.", "error");
      } else if (results.length > 0) {
        showToast(pointsEarned > 0 ? `Library synced. +${pointsEarned} points.` : "Library synced.", "success");
      }

      notifyNewAchievements(newAchievements, showToast);

      router.refresh();
    } catch {
      showToast("Couldn't reach the server. Please try again.", "error");
    } finally {
      setSyncing(false);
    }
  }

  async function handleLogout() {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.promoted) {
      showToast(`Signed out — now using ${data.promoted.displayName}.`, "info");
    }
    router.push("/");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border/60 bg-surface/70 px-4 backdrop-blur-xl">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent"
      />

      <Link href="/dashboard" className="group flex items-center gap-2.5">
        <motion.div
          whileHover={{ rotate: -8, scale: 1.08 }}
          transition={{ type: "spring", stiffness: 400, damping: 15 }}
          className="icon-badge h-9 w-9"
        >
          <Gamepad2 className="glow-accent-text" size={19} />
        </motion.div>
        <span className="text-lg font-bold tracking-tight text-gradient">GameHub</span>
      </Link>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <SoundToggle />
        <NotificationBell />

        <button onClick={handleSync} disabled={syncing} className="btn-ghost disabled:opacity-50">
          <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
          <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync"}</span>
        </button>

        <Link href="/big-picture" className="btn-ghost !px-2.5" title="Big Picture mode">
          <Tv size={15} />
        </Link>

        <Link href="/store" className="btn-ghost !px-2.5" title="Store">
          <Gem size={15} className="text-accent-bright" />
          <span className="hidden sm:inline">{points}</span>
        </Link>

        <button onClick={handleLogout} className="btn-ghost !px-2.5" title="Log out">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
