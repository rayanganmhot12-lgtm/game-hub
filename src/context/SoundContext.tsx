"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { playClickSound, playHoverSound, playSuccessSound, playWarningSound, playPlusFanfare, playAnnouncementSound, startRingtone } from "@/lib/sound";

const SOUND_STORAGE_KEY = "gamehub-sound-muted";

interface SoundContextValue {
  muted: boolean;
  toggleMuted: () => void;
  playSuccess: () => void;
  playWarning: () => void;
  playRingtone: () => () => void;
  playPlus: () => void;
  playAnnouncement: () => void;
}

const SoundContext = createContext<SoundContextValue | null>(null);

export function SoundProvider({ children }: { children: ReactNode }) {
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(muted);
  const lastHoverRef = useRef(0);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored === "true") setMuted(true);
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (mutedRef.current) return;
      const target = (e.target as HTMLElement)?.closest("button, a[href]");
      if (target) playClickSound();
    }
    function handlePointerOver(e: PointerEvent) {
      if (mutedRef.current) return;
      const target = (e.target as HTMLElement)?.closest("button");
      if (!target) return;
      const now = Date.now();
      if (now - lastHoverRef.current < 150) return;
      lastHoverRef.current = now;
      playHoverSound();
    }
    document.addEventListener("click", handleClick, true);
    document.addEventListener("pointerover", handlePointerOver, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("pointerover", handlePointerOver, true);
    };
  }, []);

  function toggleMuted() {
    setMuted((prev) => {
      const next = !prev;
      window.localStorage.setItem(SOUND_STORAGE_KEY, String(next));
      return next;
    });
  }

  function playSuccess() {
    if (!mutedRef.current) playSuccessSound();
  }

  function playWarning() {
    if (!mutedRef.current) playWarningSound();
  }

  function playRingtone(): () => void {
    if (mutedRef.current) return () => {};
    return startRingtone();
  }

  function playPlus() {
    if (!mutedRef.current) playPlusFanfare();
  }

  function playAnnouncement() {
    if (!mutedRef.current) playAnnouncementSound();
  }

  return (
    <SoundContext.Provider value={{ muted, toggleMuted, playSuccess, playWarning, playRingtone, playPlus, playAnnouncement }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound() {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error("useSound must be used within a SoundProvider");
  return ctx;
}
