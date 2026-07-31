"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  ReactNode,
} from "react";

export interface Track {
  id: string;
  title: string;
}

interface MusicPlayerContextValue {
  tracks: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  autoplayBlocked: boolean;
  loading: boolean;
  currentTime: number;
  duration: number;
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  playTrackAt: (index: number) => void;
  setVolume: (v: number) => void;
  toggleMuted: () => void;
  toggleShuffle: () => void;
  refreshTracks: () => Promise<void>;
  removeTrack: (id: string) => Promise<void>;
}

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

const VOLUME_KEY = "gamehub-music-volume";
const MUTED_KEY = "gamehub-music-muted";
const SHUFFLE_KEY = "gamehub-music-shuffle";

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const shuffleRef = useRef(false);
  const hasAttemptedAutoplay = useRef(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const [muted, setMutedState] = useState(false);
  const [shuffle, setShuffleState] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack = tracks[currentIndex] ?? null;

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  useEffect(() => {
    shuffleRef.current = shuffle;
  }, [shuffle]);

  const refreshTracks = useCallback(async () => {
    const res = await fetch("/api/playlist");
    if (!res.ok) return;
    const data = await res.json();
    setTracks(data.tracks ?? []);
  }, []);

  // Load persisted preferences on mount (localStorage isn't available during SSR).
  useEffect(() => {
    const v = window.localStorage.getItem(VOLUME_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v) setVolumeState(parseFloat(v));
    const m = window.localStorage.getItem(MUTED_KEY);
    if (m === "true") setMutedState(true);
    const s = window.localStorage.getItem(SHUFFLE_KEY);
    if (s === "true") setShuffleState(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshTracks().finally(() => setLoading(false));
  }, [refreshTracks]);

  // Create the <audio> element once, for the lifetime of the app.
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.muted = muted;
    audioRef.current = audio;

    function handleEnded() {
      const list = tracksRef.current;
      if (list.length === 0) return;
      setCurrentIndex((current) => pickNextIndex(current, list, shuffleRef.current));
      setIsPlaying(true);
    }
    function handleTimeUpdate() {
      setCurrentTime(audio.currentTime);
    }
    function handleLoadedMetadata() {
      setDuration(audio.duration || 0);
    }
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load (and possibly autoplay) whenever the current track changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    audio.src = `/api/playlist/${currentTrack.id}/file`;
    setCurrentTime(0);
    setDuration(0);

    if (!hasAttemptedAutoplay.current) {
      hasAttemptedAutoplay.current = true;
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setAutoplayBlocked(true));
    } else if (isPlaying) {
      audio.play().catch(() => setAutoplayBlocked(true));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id]);

  // If autoplay was blocked, resume on the user's first interaction anywhere.
  useEffect(() => {
    if (!autoplayBlocked) return;
    function handleFirstInteraction() {
      const audio = audioRef.current;
      if (!audio) return;
      audio
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {});
    }
    document.addEventListener("click", handleFirstInteraction, { once: true });
    return () => document.removeEventListener("click", handleFirstInteraction);
  }, [autoplayBlocked]);

  function pickNextIndex(current: number, list: Track[], useShuffle: boolean) {
    if (list.length === 0) return 0;
    if (useShuffle) {
      if (list.length === 1) return 0;
      let idx = current;
      while (idx === current) idx = Math.floor(Math.random() * list.length);
      return idx;
    }
    return (current + 1) % list.length;
  }

  function play() {
    audioRef.current
      ?.play()
      .then(() => setIsPlaying(true))
      .catch(() => setAutoplayBlocked(true));
  }
  function pause() {
    audioRef.current?.pause();
    setIsPlaying(false);
  }
  function togglePlay() {
    if (isPlaying) pause();
    else play();
  }
  function next() {
    setCurrentIndex((current) => pickNextIndex(current, tracksRef.current, shuffleRef.current));
    setIsPlaying(true);
  }
  function prev() {
    const list = tracksRef.current;
    if (list.length === 0) return;
    setCurrentIndex((current) => (current - 1 + list.length) % list.length);
    setIsPlaying(true);
  }
  function playTrackAt(index: number) {
    setCurrentIndex(index);
    setIsPlaying(true);
  }
  function seek(time: number) {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }
  function setVolume(v: number) {
    setVolumeState(v);
    window.localStorage.setItem(VOLUME_KEY, String(v));
    if (audioRef.current) audioRef.current.volume = v;
  }
  function toggleMuted() {
    setMutedState((prevMuted) => {
      const nextMuted = !prevMuted;
      window.localStorage.setItem(MUTED_KEY, String(nextMuted));
      if (audioRef.current) audioRef.current.muted = nextMuted;
      return nextMuted;
    });
  }
  function toggleShuffle() {
    setShuffleState((prevShuffle) => {
      const nextShuffle = !prevShuffle;
      window.localStorage.setItem(SHUFFLE_KEY, String(nextShuffle));
      return nextShuffle;
    });
  }
  async function removeTrack(id: string) {
    await fetch(`/api/playlist/${id}`, { method: "DELETE" });
    await refreshTracks();
  }

  return (
    <MusicPlayerContext.Provider
      value={{
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
        play,
        pause,
        togglePlay,
        next,
        prev,
        playTrackAt,
        setVolume,
        toggleMuted,
        toggleShuffle,
        refreshTracks,
        removeTrack,
      }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  return ctx;
}
