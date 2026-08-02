"use client";

import { useEffect } from "react";
import { publishMyProfile } from "@/lib/profileRealtime";

// Keeps this installation's public profile snapshot in Firebase fresh —
// mounted globally so any change made anywhere (Profile page, Store equips)
// gets picked up the next time any page renders, not just /profile visits.
export default function ProfilePublisher({
  myCode,
  displayName,
  avatarDataUrl,
  bannerDataUrl,
  bio,
  pronouns,
  profileNote,
  badge,
  frame,
  banner,
  accentColor,
  pinnedCosmeticId,
  nameEffect,
}: {
  myCode: string;
  displayName: string;
  avatarDataUrl: string | null;
  bannerDataUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  profileNote: string | null;
  badge: string | null;
  frame: string | null;
  banner: string | null;
  accentColor: string | null;
  pinnedCosmeticId: string | null;
  nameEffect: string | null;
}) {
  useEffect(() => {
    publishMyProfile(myCode, {
      displayName,
      avatarDataUrl,
      bannerDataUrl,
      bio,
      pronouns,
      profileNote,
      badge,
      frame,
      banner,
      accentColor,
      pinnedCosmeticId,
      nameEffect,
    });
  }, [
    myCode,
    displayName,
    avatarDataUrl,
    bannerDataUrl,
    bio,
    pronouns,
    profileNote,
    badge,
    frame,
    banner,
    accentColor,
    pinnedCosmeticId,
    nameEffect,
  ]);

  return null;
}
