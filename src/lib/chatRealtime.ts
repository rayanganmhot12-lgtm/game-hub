"use client";

import { ref, push, onChildAdded, off, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface ChatMessagePayload {
  fromCode: string;
  fromDisplayName: string;
  text: string;
  sentAt: number;
  clientId?: string;
}

// Both sides derive the same channel name from their two codes, sorted so
// order doesn't matter — no separate "create a conversation" step needed.
export function conversationId(codeA: string, codeB: string): string {
  return [codeA, codeB].sort().join("_");
}

export function sendChatMessage(
  convId: string,
  fromCode: string,
  fromDisplayName: string,
  text: string,
  clientId: string
) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return push(ref(db, `messages/${convId}`), {
    fromCode,
    fromDisplayName,
    text,
    sentAt: Date.now(),
    clientId,
  });
}

// Firebase is purely a relay here, not storage — each incoming message (from
// the other person, not our own echo) gets handed to the caller to save
// locally, then removed from Firebase. If the recipient is offline, the
// message just waits in Firebase until they next open the chat and this
// listener attaches.
export function listenForChatMessages(
  convId: string,
  myCode: string,
  onMessage: (message: ChatMessagePayload, messageId: string) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const convRef = ref(db, `messages/${convId}`);

  const handler = (snapshot: DataSnapshot) => {
    const message = snapshot.val() as ChatMessagePayload | null;
    if (!message || !snapshot.key) return;
    if (message.fromCode === myCode) return; // our own echo — already saved on send
    onMessage(message, snapshot.key);
  };

  onChildAdded(convRef, handler);
  return () => off(convRef, "child_added", handler);
}

export function removeChatMessage(convId: string, messageId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `messages/${convId}/${messageId}`));
}
