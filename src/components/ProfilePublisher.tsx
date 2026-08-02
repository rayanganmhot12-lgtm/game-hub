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
  nameEffectColor1,
  nameEffectColor2,
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
  nameEffectColor1: string | null;
  nameEffectColor2: string | null;
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
      nameEffectColor1,
      nameEffectColor2,
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
    nameEffectColor1,
    nameEffectColor2,
  ]);

  return null;
}
