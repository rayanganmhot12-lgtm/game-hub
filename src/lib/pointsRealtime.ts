"use client";

import { ref, push, onChildAdded, off, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface PointsGiftPayload {
  amount: number;
  fromCode: string;
  fromDisplayName: string;
  createdAt: number;
}

export function sendPointsGift(targetCode: string, amount: number, fromCode: string, fromDisplayName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Points gifting needs Firebase set up — see the README."));
  return push(ref(db, `pointsGifts/${targetCode}`), {
    amount,
    fromCode,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForPointsGifts(myCode: string, onGift: (gift: PointsGiftPayload, giftId: string) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const giftRef = ref(db, `pointsGifts/${myCode}`);
  const handler = (snapshot: DataSnapshot) => {
    const gift = snapshot.val() as PointsGiftPayload | null;
    if (!gift || !snapshot.key) return;
    onGift(gift, snapshot.key);
  };
  onChildAdded(giftRef, handler);
  return () => off(giftRef, "child_added", handler);
}

export function removePointsGift(myCode: string, giftId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `pointsGifts/${myCode}/${giftId}`));
}
