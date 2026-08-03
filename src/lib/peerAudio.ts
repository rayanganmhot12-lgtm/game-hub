"use client";

import { useSyncExternalStore } from "react";

export interface PeerAudioSettings {
  /** Silenced for you only. Nobody else is told, and their mic keeps running. */
  muted: boolean;
  /** 0 to MAX_PEER_VOLUME, where 1 is unchanged. */
  volume: number;
}

// Above 1 is real amplification, for the friend whose microphone is set too
// low to fix from their end.
export const MAX_PEER_VOLUME = 2;

const DEFAULT_SETTINGS: PeerAudioSettings = { muted: false, volume: 1 };
const STORAGE_KEY = "gamehub-peer-audio";

// A module store rather than context state, because three unrelated places
// need the same answer: the audio graph applying it, the menu setting it, and
// two call contexts that shouldn't each own a copy. Persisted, so someone you
// turned down stays turned down next call — which is the whole point of
// setting it per person.
type Store = Record<string, PeerAudioSettings>;

let cache: Store | null = null;
const listeners = new Set<() => void>();

// Stable identity for the server render, or useSyncExternalStore loops.
const EMPTY: Store = {};

function load(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    cache = parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    cache = {};
  }
  return cache;
}

function getSnapshot(): Store {
  return load();
}

function getServerSnapshot(): Store {
  return EMPTY;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getPeerAudio(code: string): PeerAudioSettings {
  return load()[code] ?? DEFAULT_SETTINGS;
}

export function setPeerAudio(code: string, patch: Partial<PeerAudioSettings>) {
  const current = getPeerAudio(code);
  // A fresh object every write: useSyncExternalStore compares snapshots by
  // identity, so mutating in place would publish nothing.
  cache = { ...load(), [code]: { ...current, ...patch } };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Storage being unavailable costs the setting its persistence, not its effect.
  }
  listeners.forEach((listener) => listener());
}

export function usePeerAudio(code: string): PeerAudioSettings {
  const all = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return all[code] ?? DEFAULT_SETTINGS;
}
