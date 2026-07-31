"use client";

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// Chat/voice/moderation all relay through Firebase Realtime Database — it's
// only ever used as a live pub/sub relay, never as the source of truth.
// Each user's own chat history, friend list, and moderation state live in
// their local SQLite, same as everything else in Game Hub.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.databaseURL);

let app: FirebaseApp | null = null;
let db: Database | null = null;

// Returns null (rather than throwing) when Firebase isn't configured, so
// every caller can gracefully show a "not set up yet" state instead of
// crashing the rest of the app.
export function getFirebaseDb(): Database | null {
  if (!isFirebaseConfigured) return null;
  if (!db) {
    app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
    db = getDatabase(app);
  }
  return db;
}
