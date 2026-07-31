"use client";

import { ref, onValue, off, get, set, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

// clientId -> emoji -> array of reactor friend codes. Generic over both 1:1
// chat (base path `chatReactions/{convId}`) and group chat
// (`groupReactions/{groupId}`) — kept live in Firebase indefinitely (like
// group messages/roster), not deleted after read, since every viewer needs
// to see the same current reaction state.
export type ReactionMap = Record<string, Record<string, string[]>>;

export function listenForReactions(basePath: string, onChange: (reactions: ReactionMap) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const reactionsRef = ref(db, basePath);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as ReactionMap | null) ?? {});
  onValue(reactionsRef, handler);
  return () => off(reactionsRef, "value", handler);
}

export async function toggleReaction(basePath: string, clientId: string, emoji: string, myCode: string) {
  const db = getFirebaseDb();
  if (!db) return;
  const emojiRef = ref(db, `${basePath}/${clientId}/${emoji}`);
  const snapshot = await get(emojiRef);
  const current: string[] = snapshot.val() ?? [];
  const next = current.includes(myCode) ? current.filter((c) => c !== myCode) : [...current, myCode];
  if (next.length === 0) {
    await remove(emojiRef);
  } else {
    await set(emojiRef, next);
  }
}
