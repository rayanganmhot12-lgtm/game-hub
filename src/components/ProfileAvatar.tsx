"use client";

import { useEffect, useState } from "react";
import Avatar from "@/components/Avatar";
import { fetchProfile } from "@/lib/profileRealtime";

// Wherever a friend's real profile photo should appear instead of the
// plain initials circle: fetches their published profile once per code and
// falls back to Avatar if they haven't set a photo (or Firebase isn't
// configured).
export default function ProfileAvatar({
  code,
  displayName,
  size = 32,
}: {
  code: string;
  displayName: string;
  size?: number;
}) {
  // Keeps the fetched avatar paired with the code it was fetched for, so a
  // still-loading result for a newly-changed code doesn't render the
  // previous code's photo instead of falling back to Avatar while it loads.
  const [loaded, setLoaded] = useState<{ code: string; avatarDataUrl: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchProfile(code).then((profile) => {
      if (!cancelled) setLoaded({ code, avatarDataUrl: profile?.avatarDataUrl ?? null });
    });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const avatarDataUrl = loaded?.code === code ? loaded.avatarDataUrl : null;

  if (avatarDataUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
      <img
        src={avatarDataUrl}
        alt={displayName}
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <Avatar name={displayName} size={size} />;
}
