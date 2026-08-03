"use client";

import {
  ref,
  push,
  onChildAdded,
  off,
  remove,
  get,
  query,
  limitToLast,
  type DataSnapshot,
} from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface AnnouncementPayload {
  message: string;
  fromDisplayName: string;
  createdAt: number;
}

// How far back a broadcast is still worth showing. Someone whose app was closed
// for an hour should still get it; someone away for a week should not be buried
// in dead news the moment they open it.
export const ANNOUNCEMENT_FRESHNESS_MS = 24 * 60 * 60 * 1000;

// onChildAdded fires once per existing child on first subscribe, so an
// unbounded listener hands a brand new client the entire history at once. The
// freshness window below does the real filtering; this keeps the initial burst
// small in the first place.
const BROADCAST_HISTORY_LIMIT = 20;

// Unlike a warning (a moderation action, shown full-screen and scary),
// an announcement is a friendly one-way broadcast — just informational.
export function sendAnnouncement(targetCode: string, message: string, fromDisplayName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Announcements need Firebase set up — see the README."));
  return push(ref(db, `announcements/${targetCode}`), {
    message,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForAnnouncements(myCode: string, onAnnouncement: (a: AnnouncementPayload, id: string) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const annRef = ref(db, `announcements/${myCode}`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as AnnouncementPayload | null;
    if (!val || !snapshot.key) return;
    onAnnouncement(val, snapshot.key);
  };
  onChildAdded(annRef, handler);
  return () => off(annRef, "child_added", handler);
}

// Safe to delete on dismissal: this node was addressed to one recipient, and
// they are the one dismissing it.
export function removeAnnouncement(myCode: string, id: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `announcements/${myCode}/${id}`));
}

// One node read by everyone, rather than a copy pushed per recipient — which is
// what limited "Send to All" to the sender's own friends list.
//
// Because the node is shared, no recipient may delete it: that would dismiss the
// announcement for every other person at the same moment. Dismissal is tracked
// locally instead, in seenAnnouncements.ts.
export function sendGlobalAnnouncement(message: string, fromDisplayName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Announcements need Firebase set up — see the README."));
  return push(ref(db, "announcements/global"), {
    message,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForGlobalAnnouncements(onAnnouncement: (a: AnnouncementPayload, id: string) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const globalRef = query(ref(db, "announcements/global"), limitToLast(BROADCAST_HISTORY_LIMIT));
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as AnnouncementPayload | null;
    if (!val || !snapshot.key) return;
    if (Date.now() - val.createdAt > ANNOUNCEMENT_FRESHNESS_MS) return;
    onAnnouncement(val, snapshot.key);
  };
  onChildAdded(globalRef, handler);
  return () => off(globalRef, "child_added", handler);
}

// Nobody deletes a broadcast on dismissal, so without this the node grows for
// the life of the project. The sender clears whatever has aged out of the window
// on each send: one-sided cleanup, needing no permission a sender lacks.
export async function pruneOldGlobalAnnouncements() {
  const db = getFirebaseDb();
  if (!db) return;
  const snapshot = await get(ref(db, "announcements/global"));
  const all = snapshot.val() as Record<string, AnnouncementPayload> | null;
  if (!all) return;
  const cutoff = Date.now() - ANNOUNCEMENT_FRESHNESS_MS;
  const stale = Object.keys(all).filter((id) => all[id].createdAt < cutoff);
  await Promise.all(stale.map((id) => remove(ref(db, `announcements/global/${id}`))));
}
