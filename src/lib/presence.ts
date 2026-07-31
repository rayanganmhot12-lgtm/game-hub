"use client";

import { ref, set, update, get, onDisconnect, onValue, off, serverTimestamp, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export type PresenceStatusValue = "online" | "idle" | "dnd" | "invisible";

export interface PresenceState {
  online: boolean;
  lastSeen: number | object;
  // A user-chosen presentation, independent of the raw connection state
  // above — "invisible" still means genuinely connected (online: true) but
  // should be *shown* to everyone else as offline. Defaults to "online" for
  // anyone who's never set one.
  status?: PresenceStatusValue;
}

export const STATUS_META: Record<PresenceStatusValue, { label: string; dotClassName: string }> = {
  online: { label: "Online", dotClassName: "bg-emerald-400" },
  idle: { label: "Idle", dotClassName: "bg-amber-400" },
  dnd: { label: "Do Not Disturb", dotClassName: "bg-red-500" },
  invisible: { label: "Invisible", dotClassName: "bg-surface-2" },
};

// What dot color/label a viewer should see for someone's presence. An
// "invisible" status is only ever shown truthfully to the person themselves —
// everyone else sees plain offline, same as real Discord.
export function presenceDisplay(
  state: PresenceState | null | undefined,
  isSelf: boolean
): { label: string; dotClassName: string; online: boolean } {
  if (!state?.online) return { label: "Offline", dotClassName: "bg-surface-2", online: false };
  const status = state.status ?? "online";
  if (status === "invisible" && !isSelf) {
    return { label: "Offline", dotClassName: "bg-surface-2", online: false };
  }
  return { ...STATUS_META[status], online: true };
}

// Firebase's standard presence pattern: as soon as this client is actually
// connected (".info/connected" fires true), register an onDisconnect hook
// that flips us to offline the moment the connection drops for any reason
// (tab closed, network loss, app quit) — no client-side cleanup needed.
export function startPresenceHeartbeat(myCode: string) {
  const db = getFirebaseDb();
  if (!db) return () => {};

  const myPresenceRef = ref(db, `presence/${myCode}`);
  const connectedRef = ref(db, ".info/connected");

  const handler = onValue(connectedRef, (snapshot) => {
    if (snapshot.val() !== true) return;
    onDisconnect(myPresenceRef)
      // A partial update, not a full set — otherwise this overwrites
      // `status` back to nothing the instant the connection drops (e.g. on
      // every page reload), independent of the reconnect-side preservation
      // below.
      .update({ online: false, lastSeen: serverTimestamp() })
      .then(async () => {
        // Preserve whatever status the user last chose (e.g. Do Not
        // Disturb) across reconnects — this write replaces the whole
        // entry, so anything not carried forward here gets wiped, the
        // same trap the group roster join had.
        const existing = (await get(myPresenceRef)).val() as PresenceState | null;
        set(myPresenceRef, { online: true, lastSeen: serverTimestamp(), status: existing?.status ?? "online" });
      });
  });

  return () => off(connectedRef, "value", handler);
}

// Changes only the status field, leaving online/lastSeen alone.
export function setMyStatus(myCode: string, status: PresenceStatusValue) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return update(ref(db, `presence/${myCode}`), { status });
}

export function listenToPresence(friendCode: string, callback: (state: PresenceState | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const presenceRef = ref(db, `presence/${friendCode}`);
  const handler = (snapshot: DataSnapshot) => callback(snapshot.val());
  onValue(presenceRef, handler);
  return () => off(presenceRef, "value", handler);
}
