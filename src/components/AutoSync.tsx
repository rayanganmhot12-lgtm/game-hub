"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { runSync, notifyNewAchievements } from "@/lib/syncClient";

const AUTO_SYNC_INTERVAL_MS = 20 * 60 * 1000; // 20 minutes

// Silent background sync while the app stays open — no button click needed.
// Stays quiet unless something's actually worth telling the user about
// (a new achievement), to avoid a "Library synced" toast every 20 minutes.
export default function AutoSync() {
  const router = useRouter();
  const { showToast } = useToast();

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const results = await runSync();
        const newAchievements = results.flatMap((r) => r.newAchievements ?? []);
        notifyNewAchievements(newAchievements, showToast);
        if (results.some((r) => r.ok)) {
          router.refresh();
        }
      } catch {
        // Background automation — fail silently, the next interval will retry.
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router, showToast]);

  return null;
}
