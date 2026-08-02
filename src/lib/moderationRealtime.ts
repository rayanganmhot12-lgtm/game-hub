"use client";

import { ref, set, update, get, onValue, onChildAdded, off, push, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface ModerationState {
  banned?: boolean;
  muted?: boolean;
  timeoutUntil?: number | null;
}

export interface WarningPayload {
  message: string;
  fromDisplayName: string;
  createdAt: number;
}

export function isRestricted(state: ModerationState | null): { restricted: boolean; reason: string } {
  if (!state) return { restricted: false, reason: "" };
  if (state.banned) return { restricted: true, reason: "You've been banned by an admin." };
  if (state.muted) return { restricted: true, reason: "You've been muted by an admin." };
  if (state.timeoutUntil && state.timeoutUntil > Date.now()) {
    const minutes = Math.ceil((state.timeoutUntil - Date.now()) / 60000);
    return { restricted: true, reason: `You're timed out for ${minutes} more minute${minutes === 1 ? "" : "s"}.` };
  }
  return { restricted: false, reason: "" };
}

export async function getModerationState(code: string): Promise<ModerationState | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snap = await get(ref(db, `moderation/${code}`));
  return snap.val();
}

export function listenToModerationState(code: string, callback: (state: ModerationState | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const modRef = ref(db, `moderation/${code}`);
  const handler = onValue(modRef, (snapshot) => callback(snapshot.val()));
  return () => off(modRef, "value", handler);
}

// Merges into the existing state at this path — each caller only passes the
// one field it's changing (e.g. just `muted`), so a plain `set()` here would
// silently wipe out any other restriction already in place (a ban, a
// timeout) that isn't part of this particular call.
export function setModerationState(code: string, state: ModerationState) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return update(ref(db, `moderation/${code}`), state);
}

// Explicitly clears every restriction at once — unlike setModerationState,
// this really does replace the whole node (that's the point of a reset).
export function resetModerationState(code: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return set(ref(db, `moderation/${code}`), { banned: false, muted: false, timeoutUntil: null });
}

export type AdminBadgeGrants = Record<string, boolean>;

// Admin-granted badges live at their own path, never inside profiles/{code}
// — ProfilePublisher re-publishes that node's `badge` field from the
// target's own equippedBadge every time any of their own profile fields
// change, which would silently clobber an override stored there. This
// path is never touched by the target's own client.
export function grantAdminBadge(code: string, badgeId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return update(ref(db, `adminBadges/${code}`), { [badgeId]: true });
}

export function revokeAdminBadge(code: string, badgeId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return remove(ref(db, `adminBadges/${code}/${badgeId}`));
}

export async function getAdminBadges(code: string): Promise<AdminBadgeGrants> {
  const db = getFirebaseDb();
  if (!db) return {};
  const snap = await get(ref(db, `adminBadges/${code}`));
  return snap.val() ?? {};
}

export function sendWarning(targetCode: string, message: string, fromDisplayName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return push(ref(db, `warnings/${targetCode}`), {
    message,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForWarnings(myCode: string, onWarning: (warning: WarningPayload & { id: string }) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const warnRef = ref(db, `warnings/${myCode}`);

  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as WarningPayload | null;
    if (!val || !snapshot.key) return;
    onWarning({ id: snapshot.key, ...val });
  };

  onChildAdded(warnRef, handler);
  return () => off(warnRef, "child_added", handler);
}

export function removeWarning(myCode: string, warningId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `warnings/${myCode}/${warningId}`));
}
