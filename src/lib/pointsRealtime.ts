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

export interface PointsWithdrawalPayload {
  amount: number;
  fromCode: string;
  fromDisplayName: string;
  createdAt: number;
}

// Requests that the TARGET's own client deduct points from their own local
// balance — this app has no server-side authority over anyone's balance but
// their own, so a "withdrawal" is really just a request relayed the same way
// a gift is, honored by the target's own running app.
export function sendPointsWithdrawal(targetCode: string, amount: number, fromCode: string, fromDisplayName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Points withdrawal needs Firebase set up — see the README."));
  return push(ref(db, `pointsWithdrawals/${targetCode}`), {
    amount,
    fromCode,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForPointsWithdrawals(myCode: string, onWithdrawal: (withdrawal: PointsWithdrawalPayload, id: string) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const withdrawalRef = ref(db, `pointsWithdrawals/${myCode}`);
  const handler = (snapshot: DataSnapshot) => {
    const withdrawal = snapshot.val() as PointsWithdrawalPayload | null;
    if (!withdrawal || !snapshot.key) return;
    onWithdrawal(withdrawal, snapshot.key);
  };
  onChildAdded(withdrawalRef, handler);
  return () => off(withdrawalRef, "child_added", handler);
}

export function removePointsWithdrawal(myCode: string, id: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `pointsWithdrawals/${myCode}/${id}`));
}
