"use client";

import { ref, update, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface PublicProfileTag {
  name: string;
  badge: string;
  color: string;
}

export interface PublicProfile {
  displayName: string;
  avatarDataUrl?: string | null;
  bannerDataUrl?: string | null;
  bio?: string | null;
  pronouns?: string | null;
  profileNote?: string | null;
  badge?: string | null;
  frame?: string | null;
  banner?: string | null;
  accentColor?: string | null;
  // The one owned cosmetic "pinned" to show on the profile card — see
  // pinnedCosmeticId on the User model.
  pinnedCosmeticId?: string | null;
  // The last Server Tag the user equipped, from any server — see
  // publishActiveTag. Not managed by ProfilePublisher, so this uses a
  // Firebase `update()` (merge), not `set()`, everywhere it's touched, or
  // this field would get wiped every time the rest of the profile changes.
  tag?: PublicProfileTag | null;
  updatedAt: number;
}

// Every installation publishes a small snapshot of its own current profile
// (photo, name, cosmetics) to Firebase under its own friend code — the only
// way for a friend's separate local database to ever see it live, since
// there's no shared backend beyond this relay. Uses `update()` (merge) so it
// doesn't clobber the `tag` field, which is published separately.
export function publishMyProfile(myCode: string, profile: Omit<PublicProfile, "updatedAt" | "tag">) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return update(ref(db, `profiles/${myCode}`), { ...profile, updatedAt: Date.now() });
}

// Called whenever someone (un)equips a server's Tag — publishes it as their
// globally-visible "last equipped tag", shown on their friend-profile card
// regardless of which server it came from.
export function publishActiveTag(myCode: string, tag: PublicProfileTag | null) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return update(ref(db, `profiles/${myCode}`), { tag, updatedAt: Date.now() });
}

export async function fetchProfile(code: string): Promise<PublicProfile | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snapshot = await get(ref(db, `profiles/${code}`));
  return snapshot.val();
}
