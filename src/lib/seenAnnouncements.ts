"use client";

const STORAGE_KEY = "gamehub-announcements-seen";

// Bounded, because nothing ever removes an id: a broadcast node outlives its
// dismissal, so the only way to remember "I closed that one" is to keep its id.
// The oldest are dropped first, and an id that falls off the end can only
// belong to an announcement long past the freshness window anyway.
const MAX_REMEMBERED = 200;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // A corrupt entry costs one repeated announcement, not a broken app.
    return [];
  }
}

/**
 * Which broadcasts this device has already dismissed.
 *
 * A global announcement is one node shared by everyone, so dismissing it
 * cannot mean deleting it — that would clear it from every other person's
 * screen at the same time. It means remembering it here instead.
 */
export function hasSeenAnnouncement(id: string): boolean {
  if (typeof window === "undefined") return false;
  return read().includes(id);
}

export function markAnnouncementSeen(id: string) {
  if (typeof window === "undefined") return;
  const seen = read();
  if (seen.includes(id)) return;
  seen.push(id);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen.slice(-MAX_REMEMBERED)));
  } catch {
    // Storage being full or blocked means the announcement may show again.
  }
}
