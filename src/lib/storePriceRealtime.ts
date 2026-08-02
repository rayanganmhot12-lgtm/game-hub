"use client";

import { ref, set, onValue, off, get, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

// Unlike the per-user relay paths (moderation/{code}, cosmeticGifts/{code}),
// store prices are one shared map everyone reads — there's a single Store,
// so the developer setting a price sets it for every install.
const STORE_PRICES_PATH = "storePrices";

export function publishStorePrices(prices: Record<string, number>) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Store pricing needs Firebase set up — see the README."));
  return set(ref(db, STORE_PRICES_PATH), prices);
}

export function fetchStorePrices(): Promise<Record<string, number>> {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve({});
  return get(ref(db, STORE_PRICES_PATH)).then((snapshot) => (snapshot.val() as Record<string, number> | null) ?? {});
}

export function listenToStorePrices(onPrices: (prices: Record<string, number>) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const pricesRef = ref(db, STORE_PRICES_PATH);
  const handler = (snapshot: DataSnapshot) => onPrices((snapshot.val() as Record<string, number> | null) ?? {});
  onValue(pricesRef, handler);
  return () => off(pricesRef, "value", handler);
}
