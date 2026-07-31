"use client";

import { ref, push, onChildAdded, off, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface CosmeticGiftPayload {
  itemId: string;
  itemName: string;
  fromCode: string;
  fromDisplayName: string;
  createdAt: number;
}

export function sendCosmeticGift(
  targetCode: string,
  itemId: string,
  itemName: string,
  fromCode: string,
  fromDisplayName: string
) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Gifting needs Firebase set up — see the README."));
  return push(ref(db, `cosmeticGifts/${targetCode}`), {
    itemId,
    itemName,
    fromCode,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForCosmeticGifts(myCode: string, onGift: (gift: CosmeticGiftPayload, giftId: string) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const giftRef = ref(db, `cosmeticGifts/${myCode}`);
  const handler = (snapshot: DataSnapshot) => {
    const gift = snapshot.val() as CosmeticGiftPayload | null;
    if (!gift || !snapshot.key) return;
    onGift(gift, snapshot.key);
  };
  onChildAdded(giftRef, handler);
  return () => off(giftRef, "child_added", handler);
}

export function removeCosmeticGift(myCode: string, giftId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `cosmeticGifts/${myCode}/${giftId}`));
}
