"use client";

import { MISSION_PLAY_GAME } from "@/lib/missions";

// Single place a game gets launched from, so every entry point (library
// cards, game detail, Big Picture) counts toward the "launch a game"
// mission — an entry point that bypassed this would silently not count.
export function launchGame(platform: string, platformGameId: string) {
  if (platform !== "STEAM") return;

  // Fire-and-forget: launching is the point, so a failed mission ping
  // (offline, server restarting) must never block or delay it.
  fetch("/api/missions/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ missionId: MISSION_PLAY_GAME }),
  }).catch(() => {});

  window.location.href = `steam://run/${platformGameId}`;
}
