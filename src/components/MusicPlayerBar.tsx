"use client";

import Link from "next/link";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Volume2, VolumeX, Music2 } from "lucide-react";
import { useMusicPlayer } from "@/context/MusicPlayerContext";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export default function MusicPlayerBar() {
  const {
    tracks,
    currentTrack,
    isPlaying,
    volume,
    muted,
    shuffle,
    autoplayBlocked,
    loading,
    currentTime,
    duration,
    seek,
    togglePlay,
    next,
    prev,
    setVolume,
    toggleMuted,
    toggleShuffle,
  } = useMusicPlayer();

  if (loading || tracks.length === 0) return null;

  return (
    <>
      {autoplayBlocked && (
        <button
          onClick={togglePlay}
          className="fixed inset-x-0 top-0 z-40 w-full bg-accent py-1.5 text-center text-xs font-medium text-black transition-transform hover:bg-accent-bright active:scale-[0.99]"
        >
          Click anywhere to start music
        </button>
      )}

      <div className="fixed left-0 right-0 top-16 z-30 border-b border-border/60 bg-surface/80 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Music2 size={16} className="shrink-0 text-accent-bright" />
            <Link href="/playlist" className="truncate text-xs text-foreground hover:underline">
              {currentTrack?.title ?? "No track"}
            </Link>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              title="Previous"
              className="rounded-md p-1.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90"
            >
              <SkipBack size={16} />
            </button>
            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              className="rounded-full bg-gradient-to-br from-accent-bright to-accent p-2 text-black shadow-[0_0_14px_rgba(var(--accent-rgb),0.4)] transition-transform duration-100 hover:brightness-105 active:scale-90"
            >
              {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
            </button>
            <button
              onClick={next}
              title="Next"
              className="rounded-md p-1.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90"
            >
              <SkipForward size={16} />
            </button>
            <button
              onClick={toggleShuffle}
              title={shuffle ? "Shuffle: on" : "Shuffle: off"}
              className={`rounded-md p-1.5 transition-transform duration-100 active:scale-90 ${
                shuffle ? "text-accent-bright" : "text-muted hover:text-foreground"
              }`}
            >
              <Shuffle size={15} />
            </button>
          </div>

          <div className="hidden items-center gap-2 sm:flex">
            <button
              onClick={toggleMuted}
              title={muted ? "Unmute" : "Mute"}
              className="text-muted transition-transform duration-100 hover:text-foreground active:scale-90"
            >
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="h-1 w-20 accent-[var(--accent)]"
            />
          </div>
        </div>

        <div className="mt-1 flex items-center gap-2">
          <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted">
            {formatTime(currentTime)}
          </span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="h-1 flex-1 accent-[var(--accent)]"
          />
          <span className="w-9 shrink-0 text-[10px] tabular-nums text-muted">{formatTime(duration)}</span>
        </div>
      </div>
    </>
  );
}
