"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useSound } from "@/context/SoundContext";

export default function SoundToggle() {
  const { muted, toggleMuted } = useSound();

  return (
    <button
      onClick={toggleMuted}
      title={muted ? "Unmute UI sounds" : "Mute UI sounds"}
      className="btn-ghost !px-2.5"
    >
      {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
    </button>
  );
}
