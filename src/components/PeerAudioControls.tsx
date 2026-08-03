"use client";

import type { CSSProperties } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { usePeerAudio, setPeerAudio, MAX_PEER_VOLUME } from "@/lib/peerAudio";

// The one implementation of "how loud is this person", shared by the member
// list's context menu and the call's own. Two copies would drift.
export default function PeerAudioControls({ code }: { code: string }) {
  const { muted, volume } = usePeerAudio(code);

  return (
    <>
      <button
        onClick={() => setPeerAudio(code, { muted: !muted })}
        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        {muted ? <VolumeX size={15} className="text-red-400" /> : <Volume2 size={15} />}
        {muted ? "Unmute for me" : "Mute for me"}
      </button>

      <div className="px-2.5 py-2">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted">Volume</span>
          <span className="tabular-nums text-foreground">{Math.round(volume * 100)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={MAX_PEER_VOLUME}
          step={0.05}
          value={volume}
          onChange={(e) => setPeerAudio(code, { volume: parseFloat(e.target.value) })}
          aria-label="Volume for this person"
          disabled={muted}
          className="slider h-3 w-full disabled:opacity-40"
          style={{ "--fill": `${(volume / MAX_PEER_VOLUME) * 100}%` } as CSSProperties}
        />
      </div>
    </>
  );
}
