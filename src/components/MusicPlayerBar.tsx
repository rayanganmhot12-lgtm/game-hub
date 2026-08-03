"use client";

import Link from "next/link";
import { useEffect, useRef, type CSSProperties } from "react";
import { Play, Pause, SkipBack, SkipForward, Shuffle, Volume2, VolumeX, Music2 } from "lucide-react";
import { useMusicPlayer } from "@/context/MusicPlayerContext";
import Equalizer from "@/components/Equalizer";

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

  // This dock is position:fixed, so it can't push anything out of its way on
  // its own — the surfaces around it have to reserve the room. It also isn't
  // always there: an empty playlist renders nothing at all. Publishing the
  // dock's real height (and clearing it when there's no dock) is what lets
  // them reserve exactly as much as currently exists, instead of a constant
  // that left dead space for anyone who hadn't uploaded music. Measured rather
  // than hard-coded so it stays right if the contents ever change height.
  const barRef = useRef<HTMLDivElement>(null);
  const hidden = loading || tracks.length === 0;
  useEffect(() => {
    const root = document.documentElement;
    const el = barRef.current;
    if (!el) {
      root.style.removeProperty("--music-bar-height");
      return;
    }
    const publish = () => root.style.setProperty("--music-bar-height", `${el.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--music-bar-height");
    };
  }, [hidden]);

  if (hidden) return null;

  const trackNumber = currentTrack ? tracks.findIndex((t) => t.id === currentTrack.id) + 1 : 0;
  const progressPct = duration > 0 ? Math.min(currentTime / duration, 1) * 100 : 0;

  return (
    <div
      ref={barRef}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-surface/85 px-3 py-2.5 backdrop-blur-xl md:px-4"
    >
      {/* Playback position along the dock's whole width. The scrubber below
          says the same thing precisely; this says it at a glance, from
          anywhere on the screen. */}
      <div className="absolute inset-x-0 top-0 h-px bg-border/40">
        <div
          className="h-full bg-gradient-to-r from-accent to-accent-bright shadow-[0_0_8px_rgba(var(--accent-rgb),0.85)]"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="icon-badge h-11 w-11 shrink-0">
            {isPlaying ? <Equalizer className="h-4" /> : <Music2 size={18} />}
          </div>
          <div className="min-w-0">
            <Link
              href="/playlist"
              className="block truncate text-sm font-medium text-foreground transition-colors hover:text-accent-bright"
            >
              {currentTrack?.title ?? "No track"}
            </Link>
            {/* Doubles as the autoplay notice. That used to be a separate bar
                pinned over the navbar for a message this line has room for. */}
            <p className="truncate text-[11px] text-muted">
              {autoplayBlocked ? "Click to start music" : `Track ${trackNumber} of ${tracks.length}`}
            </p>
          </div>
        </div>

        <div className="flex min-w-0 flex-[1.6] max-w-2xl flex-col items-center gap-1.5">
          <div className="flex items-center gap-1">
            <button
              onClick={toggleShuffle}
              title={shuffle ? "Shuffle: on" : "Shuffle: off"}
              className={`rounded-md p-1.5 transition-transform duration-100 active:scale-90 ${
                shuffle ? "text-accent-bright" : "text-muted hover:text-foreground"
              }`}
            >
              <Shuffle size={15} />
            </button>
            <button
              onClick={prev}
              title="Previous"
              className="rounded-md p-1.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90"
            >
              <SkipBack size={17} fill="currentColor" />
            </button>
            <button
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
              className={`rounded-full bg-gradient-to-br from-accent-bright to-accent p-2.5 text-black shadow-[0_0_16px_rgba(var(--accent-rgb),0.45)] transition-transform duration-100 hover:brightness-105 active:scale-90 ${
                autoplayBlocked ? "animate-pulse-ring" : ""
              }`}
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            <button
              onClick={next}
              title="Next"
              className="rounded-md p-1.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90"
            >
              <SkipForward size={17} fill="currentColor" />
            </button>
            {/* Balances the shuffle button so the play circle sits on the
                dock's centre line rather than one button to the left of it. */}
            <span className="w-[30px] shrink-0" aria-hidden />
          </div>

          <div className="flex w-full items-center gap-2">
            <span className="w-9 shrink-0 text-right text-[11px] tabular-nums text-muted">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(e) => seek(parseFloat(e.target.value))}
              aria-label="Seek"
              className="slider h-3 flex-1"
              style={{ "--fill": `${progressPct}%` } as CSSProperties}
            />
            <span className="w-9 shrink-0 text-[11px] tabular-nums text-muted">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="hidden flex-1 items-center justify-end gap-2 sm:flex">
          <button
            onClick={toggleMuted}
            title={muted ? "Unmute" : "Mute"}
            className="text-muted transition-transform duration-100 hover:text-foreground active:scale-90"
          >
            {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            aria-label="Volume"
            className="slider h-3 w-24"
            style={{ "--fill": `${(muted ? 0 : volume) * 100}%` } as CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}
