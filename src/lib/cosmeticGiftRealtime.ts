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

// The mirror of a gift: the developer account can take an item back. Same
// relay shape, separate path — this app is local-first, so the admin can
// only ask; the target's own client is what actually applies it.
export interface CosmeticRevokePayload {
  itemId: string;
  itemName: string;
  fromCode: string;
  fromDisplayName: string;
  createdAt: number;
}

export function sendCosmeticRevoke(
  targetCode: string,
  itemId: string,
  itemName: string,
  fromCode: string,
  fromDisplayName: string
) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Revoking needs Firebase set up — see the README."));
  return push(ref(db, `cosmeticRevokes/${targetCode}`), {
    itemId,
    itemName,
    fromCode,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForCosmeticRevokes(
  myCode: string,
  onRevoke: (revoke: CosmeticRevokePayload, revokeId: string) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const revokeRef = ref(db, `cosmeticRevokes/${myCode}`);
  const handler = (snapshot: DataSnapshot) => {
    const revoke = snapshot.val() as CosmeticRevokePayload | null;
    if (!revoke || !snapshot.key) return;
    onRevoke(revoke, snapshot.key);
  };
  onChildAdded(revokeRef, handler);
  return () => off(revokeRef, "child_added", handler);
}

export function removeCosmeticRevoke(myCode: string, revokeId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `cosmeticRevokes/${myCode}/${revokeId}`));
}
