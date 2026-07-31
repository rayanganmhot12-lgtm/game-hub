"use client";

import { ref, push, onValue, off, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface FriendRequestPayload {
  fromCode: string;
  fromDisplayName: string;
  fromBadge?: string | null;
  createdAt: number;
}

export interface FriendAcceptPayload {
  byCode: string;
  byDisplayName: string;
  byBadge?: string | null;
  createdAt: number;
}

function toEntries<T>(snapshot: DataSnapshot): Array<T & { id: string }> {
  const val = snapshot.val() as Record<string, T> | null;
  if (!val) return [];
  return Object.entries(val).map(([id, data]) => ({ id, ...data }));
}

export function sendFriendRequest(
  targetCode: string,
  fromCode: string,
  fromDisplayName: string,
  fromBadge?: string | null
) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet — see the Firebase setup in the README."));
  return push(ref(db, `friendRequests/${targetCode}`), {
    fromCode,
    fromDisplayName,
    fromBadge: fromBadge ?? null,
    createdAt: Date.now(),
  });
}

export function listenForFriendRequests(
  myCode: string,
  callback: (requests: Array<FriendRequestPayload & { id: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const reqRef = ref(db, `friendRequests/${myCode}`);
  const handler = onValue(reqRef, (snapshot) => callback(toEntries<FriendRequestPayload>(snapshot)));
  return () => off(reqRef, "value", handler);
}

export function removeFriendRequest(myCode: string, requestId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `friendRequests/${myCode}/${requestId}`));
}

export function sendFriendAccept(
  requesterCode: string,
  byCode: string,
  byDisplayName: string,
  byBadge?: string | null
) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return push(ref(db, `friendAccepts/${requesterCode}`), {
    byCode,
    byDisplayName,
    byBadge: byBadge ?? null,
    createdAt: Date.now(),
  });
}

export function listenForFriendAccepts(
  myCode: string,
  callback: (accepts: Array<FriendAcceptPayload & { id: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const acceptRef = ref(db, `friendAccepts/${myCode}`);
  const handler = onValue(acceptRef, (snapshot) => callback(toEntries<FriendAcceptPayload>(snapshot)));
  return () => off(acceptRef, "value", handler);
}

export function removeFriendAccept(myCode: string, acceptId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `friendAccepts/${myCode}/${acceptId}`));
}
