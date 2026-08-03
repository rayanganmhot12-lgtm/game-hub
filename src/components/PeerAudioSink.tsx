"use client";

import { useEffect, useRef } from "react";
import { usePeerAudio } from "@/lib/peerAudio";

// One AudioContext for all call audio, created on first use — by which point
// the user has certainly gestured, since they are in a call.
let callAudioContext: AudioContext | null = null;

function getCallAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!callAudioContext) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    callAudioContext = new Ctor();
  }
  if (callAudioContext.state === "suspended") callAudioContext.resume().catch(() => {});
  return callAudioContext;
}

/**
 * Plays one peer's audio at that peer's own volume.
 *
 * An element's `volume` is clamped to 1, so anything above unchanged has to go
 * through Web Audio. The element below is still mounted and still muted: a
 * WebRTC MediaStream does not produce samples through Web Audio in Chromium
 * unless it is also attached to a media element, so the element is the pump and
 * the gain node is the audible output.
 *
 * Falls back to the element's own volume if Web Audio is unavailable, which
 * costs amplification but not audio.
 */
export default function PeerAudioSink({
  code,
  stream,
  deafened = false,
}: {
  code: string;
  stream: MediaStream | null;
  deafened?: boolean;
}) {
  const { muted, volume } = usePeerAudio(code);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream) return;
    if (el.srcObject !== stream) el.srcObject = stream;

    const ctx = getCallAudioContext();
    if (!ctx) return;
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
    gainRef.current = gain;

    return () => {
      source.disconnect();
      gain.disconnect();
      gainRef.current = null;
    };
  }, [stream]);

  useEffect(() => {
    const silenced = deafened || muted;
    const gain = gainRef.current;
    if (gain) {
      gain.gain.value = silenced ? 0 : volume;
      return;
    }
    // No Web Audio: the element plays directly, capped at unchanged.
    const el = audioRef.current;
    if (el) {
      el.muted = silenced;
      el.volume = Math.min(volume, 1);
    }
  }, [deafened, muted, volume]);

  // muted by default so the element never doubles the gain node's output. The
  // fallback effect above un-mutes it only when there is no gain node.
  return <audio ref={audioRef} autoPlay muted />;
}
