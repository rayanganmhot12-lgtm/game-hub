"use client";

import { ref, push, onChildAdded, off, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface AnnouncementPayload {
  message: string;
  fromDisplayName: string;
  createdAt: number;
}

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

export function removeAnnouncement(myCode: string, id: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `announcements/${myCode}/${id}`));
}
