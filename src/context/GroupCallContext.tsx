"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  ICE_SERVERS,
  joinGroupCall as joinGroupCallRealtime,
  leaveGroupCall as leaveGroupCallRealtime,
  listenForGroupCallParticipants,
  sendGroupCallOffer,
  listenForGroupCallOffer,
  sendGroupCallAnswer,
  listenForGroupCallAnswer,
  sendGroupCallCandidate,
  listenForGroupCallCandidates,
  clearGroupCallSignals,
  updateGroupCallState,
  setCallPresence,
  clearCallPresence,
  type GroupCallParticipant,
} from "@/lib/groupCallRealtime";
import { getModerationState, isRestricted } from "@/lib/moderationRealtime";
import { isFirebaseConfigured } from "@/lib/firebase";
import {
  acquireCameraTrack,
  acquireScreenTrack,
  addVideoTrackAndRenegotiate,
  isNewRemoteOffer,
  ScreenShareCancelledError,
} from "@/lib/videoCall";
import { acquireMicTrack, listMicrophones, type MicrophoneOption } from "@/lib/audioDevices";
import { isDirectCallActive, markGroupCallActive } from "@/lib/callActivity";
import { useSound } from "@/context/SoundContext";
import PeerAudioSink from "@/components/PeerAudioSink";

// The mirror of CallContext's guard: CallWindow renders one call mode and
// gives group calls priority, so a 1:1 call running underneath a group call
// would be invisible, inaudible and impossible to hang up. The two call types
// stay mutually exclusive at the entry points.
const IN_DIRECT_CALL_ERROR = "You're already in a call — hang up first to join a voice channel.";

export interface GroupCallPeer {
  code: string;
  displayName: string;
  muted: boolean;
  deafened: boolean;
}

interface ActiveGroupCall {
  groupId: string;
  groupName: string;
  sessionId: string;
}

interface GroupCallContextValue {
  activeGroupCall: ActiveGroupCall | null;
  peers: GroupCallPeer[];
  muted: boolean;
  deafened: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  microphones: MicrophoneOption[];
  micDeviceId: string | null;
  localStream: MediaStream | null;
  joinGroupCall: (groupId: string, groupName: string) => Promise<void>;
  leaveGroupCall: () => void;
  toggleMuted: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  selectMicrophone: (deviceId: string) => Promise<void>;
  refreshMicrophones: () => Promise<void>;
  remoteStreams: Record<string, MediaStream>;
}

const GroupCallContext = createContext<GroupCallContextValue | null>(null);

export function GroupCallProvider({
  myCode,
  myDisplayName,
  children,
}: {
  myCode: string;
  myDisplayName: string;
  children: ReactNode;
}) {
  // Routed through SoundContext like every other sound, so the app's own sound
  // toggle silences these along with the rest.
  const { playMicToggle, playDeafenToggle } = useSound();
  const [activeGroupCall, setActiveGroupCall] = useState<ActiveGroupCall | null>(null);
  const [peers, setPeers] = useState<GroupCallPeer[]>([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [microphones, setMicrophones] = useState<MicrophoneOption[]>([]);
  const [micDeviceId, setMicDeviceId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  // Purely local, per-viewer preference — muting how a peer sounds to you
  // doesn't affect what anyone else hears, so no signaling needed.

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const peerCleanupRef = useRef<Map<string, Array<() => void>>>(new Map());
  const groupIdRef = useRef<string | null>(null);
  const unsubParticipantsRef = useRef<(() => void) | null>(null);
  // The screen track can end from the browser's own "Stop sharing" bar, so its
  // listener has to be removable when we stop it ourselves instead.
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  // Mirrors `muted` for use inside callbacks (joinGroupCall, toggleDeafen)
  // without recreating them on every mute toggle.
  const mutedRef = useRef(false);
  // Same, for picking which of the deafen pair of tones to play.
  const deafenedRef = useRef(false);
  // Read when joining, so a mic chosen earlier is the one that opens rather
  // than the system default.
  const micDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    micDeviceIdRef.current = micDeviceId;
  }, [micDeviceId]);
  // What mic-mute state to restore once the user un-deafens.
  const mutedBeforeDeafenRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    deafenedRef.current = deafened;
  }, [deafened]);

  // Publish whenever either changes, so the roster and the call tiles on
  // everyone else's screen reflect it. Guarded on actually being in a call:
  // updateGroupCallState uses a partial write, which on a path that no longer
  // exists would recreate the participant as two stray booleans.
  useEffect(() => {
    const groupId = activeGroupCall?.groupId;
    if (!groupId) return;
    updateGroupCallState(groupId, myCode, { muted, deafened }).catch(() => {
      // A failed publish costs other people an out-of-date icon; it must not
      // interrupt the call it describes.
    });
  }, [activeGroupCall?.groupId, myCode, muted, deafened]);

  const disconnectFromPeer = useCallback((peerCode: string) => {
    const pc = peerConnectionsRef.current.get(peerCode);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(peerCode);
      videoSendersRef.current.delete(peerCode);
    }
    const cleanups = peerCleanupRef.current.get(peerCode);
    if (cleanups) {
      cleanups.forEach((fn) => fn());
      peerCleanupRef.current.delete(peerCode);
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[peerCode];
      return next;
    });
    if (groupIdRef.current) {
      clearGroupCallSignals(groupIdRef.current, myCode, peerCode);
      clearGroupCallSignals(groupIdRef.current, peerCode, myCode);
    }
  }, [myCode]);

  const connectToPeer = useCallback(
    (peerCode: string) => {
      const groupId = groupIdRef.current;
      if (!groupId || peerConnectionsRef.current.has(peerCode)) return;

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peerConnectionsRef.current.set(peerCode, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) sendGroupCallCandidate(groupId, myCode, peerCode, event.candidate.toJSON());
      };
      pc.ontrack = (event) => {
        setRemoteStreams((prev) => ({ ...prev, [peerCode]: event.streams[0] }));
      };

      localStreamRef.current?.getTracks().forEach((track) => {
        if (!localStreamRef.current) return;
        const sender = pc.addTrack(track, localStreamRef.current);
        // If the camera was already on before this peer joined, this
        // connection's very first offer already includes video — track the
        // sender now so a later camera toggle can reuse it via replaceTrack()
        // instead of renegotiating a second time.
        if (track.kind === "video") videoSendersRef.current.set(peerCode, sender);
      });

      const unsubCandidates = listenForGroupCallCandidates(groupId, peerCode, myCode, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      const cleanups: Array<() => void> = [unsubCandidates];

      // Deterministic tie-breaker so both sides agree who offers *first* —
      // avoids both peers creating competing initial offers at once.
      if (myCode < peerCode) {
        (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendGroupCallOffer(groupId, myCode, peerCode, offer);
        })();
        const unsubAnswer = listenForGroupCallAnswer(groupId, peerCode, myCode, async (sdp) => {
          if (pc.signalingState === "stable") return; // already applied this exact answer
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        });
        cleanups.push(unsubAnswer);
      } else {
        const unsubOffer = listenForGroupCallOffer(groupId, peerCode, myCode, async (sdp) => {
          if (!isNewRemoteOffer(pc, sdp)) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendGroupCallAnswer(groupId, myCode, peerCode, answer);
        });
        cleanups.push(unsubOffer);
      }

      // Renegotiation support: whichever side did NOT take the initial
      // offerer role above still needs a way to receive a *later* offer (if
      // the other side turns their camera on) and a way to send their own
      // renegotiation offer (if THEY turn their camera on). The block above
      // already covers "receive an offer" for the answerer role and "send an
      // offer" for the offerer role — this block covers the two mirror
      // cases, so camera toggling works no matter which side does it.
      if (myCode < peerCode) {
        // I was the initial offerer — I also need to listen for a possible
        // later offer from the answerer (if they turn their camera on) and
        // respond with a fresh answer.
        const unsubRenegotiationOffer = listenForGroupCallOffer(groupId, peerCode, myCode, async (sdp) => {
          if (!isNewRemoteOffer(pc, sdp)) return;
          if (pc.signalingState !== "stable") return; // ignore while our own offer is still in flight
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendGroupCallAnswer(groupId, myCode, peerCode, answer);
        });
        cleanups.push(unsubRenegotiationOffer);
      } else {
        // I was the initial answerer — I also need a way to send my OWN
        // offer later (if I turn my camera on), and the other side's block
        // above is already listening for it via listenForGroupCallOffer.
        // Whichever side answers a given negotiation round always writes to
        // signals/{answerer}/{offerer}/answer, so listening for MY answer to
        // THEIR (this round's) offer uses the same (peerCode, myCode)
        // argument order the original offerer branch above uses — not
        // (myCode, peerCode), which would read the wrong path entirely.
        const unsubRenegotiationAnswer = listenForGroupCallAnswer(groupId, peerCode, myCode, async (sdp) => {
          if (pc.signalingState === "stable") return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        });
        cleanups.push(unsubRenegotiationAnswer);
      }

      peerCleanupRef.current.set(peerCode, cleanups);
    },
    [myCode]
  );

  const leaveGroupCall = useCallback(() => {
    try {
      for (const code of peerConnectionsRef.current.keys()) {
        disconnectFromPeer(code);
      }
      if (groupIdRef.current) {
        leaveGroupCallRealtime(groupIdRef.current, myCode);
      }
      clearCallPresence(myCode);
      unsubParticipantsRef.current?.();
      unsubParticipantsRef.current = null;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setCameraOn(false);
      setLocalStream(null);
      videoSendersRef.current.clear();
      groupIdRef.current = null;
      setPeers([]);
      setRemoteStreams({});
      setActiveGroupCall(null);
    } finally {
      // Released in `finally` so a throw from any earlier teardown step (a
      // Firebase off(), pc.close(), a track stop()) can never leak the claim.
      // A leaked flag is invisible and unrecoverable without a hard reload: it
      // blocks every future call, and because CallContext's incoming-ring
      // check consults this flag, a leaked one silently drops every future 1:1
      // call with no banner, no ringtone and no feedback of any kind.
      markGroupCallActive(false);
    }
    // Mute/deafen are treated as a standing preference, not per-call state —
    // matches Discord, where leaving a call doesn't silently unmute you.
  }, [myCode, disconnectFromPeer]);

  // Mirrors the latest leaveGroupCall for the unmount effect below. Unlike
  // CallContext's hangUp, this callback's identity is NOT stable (deps
  // [myCode, disconnectFromPeer]), so putting it in the effect's dep array
  // would tear down a LIVE call whenever that identity changed. Same
  // ref-mirror pattern already used above for `muted`.
  const leaveGroupCallRef = useRef(leaveGroupCall);
  useEffect(() => {
    leaveGroupCallRef.current = leaveGroupCall;
  }, [leaveGroupCall]);

  // The providers live in `src/app/(app)/layout.tsx`, so a client-side
  // navigation OUT of the (app) route group — "Recap" (/recap), "Big Picture"
  // (/big-picture), or logout's router.push("/") — unmounts them while a call
  // can still be live. Without this the module-level claim in lib/callActivity
  // outlives React and stays set for the rest of the page session. Running the
  // full leave (not just the flag release) also drops the peer connections and
  // tells the other participants we're gone; it is safe when idle, where every
  // step is either a no-op over empty refs or a remove() of nothing.
  useEffect(() => {
    return () => {
      leaveGroupCallRef.current();
    };
  }, []);

  const joinGroupCall = useCallback(
    async (groupId: string, groupName: string) => {
      if (isDirectCallActive()) throw new Error(IN_DIRECT_CALL_ERROR);
      // Claim the slot before the first await — getUserMedia can sit on a
      // browser permission prompt long enough for the user to also accept an
      // incoming 1:1 call, which is exactly what this guard prevents.
      markGroupCallActive(true);
      let established = false;
      try {
        const state = await getModerationState(myCode);
        const { restricted, reason } = isRestricted(state);
        if (restricted) throw new Error(reason);
        if (!isFirebaseConfigured) throw new Error("Voice calls aren't set up yet — see the README for Firebase setup.");

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: micDeviceIdRef.current ? { deviceId: { exact: micDeviceIdRef.current } } : true,
        });
        // Carry the standing mute preference into the fresh track — otherwise
        // a pre-set mute would silently stop applying on your next call.
        stream.getAudioTracks().forEach((track) => (track.enabled = !mutedRef.current));
        localStreamRef.current = stream;
        setLocalStream(stream);
        groupIdRef.current = groupId;

        // The standing mute preference is carried into the published record
        // too, or someone who joins already muted would appear open.
        await joinGroupCallRealtime(groupId, myCode, myDisplayName, {
          muted: mutedRef.current,
          deafened: deafenedRef.current,
        });
        await setCallPresence(myCode, groupId, groupName);
        setActiveGroupCall({ groupId, groupName, sessionId: crypto.randomUUID() });
        established = true;

        unsubParticipantsRef.current = listenForGroupCallParticipants(
          groupId,
          (participants: Array<GroupCallParticipant & { code: string }>) => {
            const codes = new Set(participants.map((p) => p.code));
            setPeers(
              participants
                .filter((p) => p.code !== myCode)
                .map((p) => ({
                  code: p.code,
                  displayName: p.displayName,
                  muted: p.muted ?? false,
                  deafened: p.deafened ?? false,
                }))
            );

            for (const p of participants) {
              if (p.code !== myCode && !peerConnectionsRef.current.has(p.code)) {
                connectToPeer(p.code);
              }
            }
            for (const code of [...peerConnectionsRef.current.keys()]) {
              if (!codes.has(code)) disconnectFromPeer(code);
            }
          }
        );
      } catch (err) {
        // Release the claim only if no call actually came up — once
        // setActiveGroupCall has run, leaveGroupCall owns releasing it.
        if (!established) markGroupCallActive(false);
        throw err;
      }
    },
    [myCode, myDisplayName, connectToPeer, disconnectFromPeer]
  );

  const toggleMuted = useCallback(() => {
    // From the ref rather than the updater: the sound has to be chosen once,
    // and setState updaters can run more than once for a single call.
    playMicToggle(!mutedRef.current);
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
      return next;
    });
    // Unmuting while deafened also restores hearing — same as Discord,
    // where reaching for your mic implies you want back into the call. No
    // second tone for it: one press is one sound.
    setDeafened((prev) => (prev ? false : prev));
  }, [playMicToggle]);

  const toggleDeafen = useCallback(() => {
    playDeafenToggle(!deafenedRef.current);
    setDeafened((prev) => {
      const next = !prev;
      if (next) {
        mutedBeforeDeafenRef.current = mutedRef.current;
        setMuted(true);
        localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = false));
      } else {
        const restoreMuted = mutedBeforeDeafenRef.current;
        setMuted(restoreMuted);
        localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !restoreMuted));
      }
      return next;
    });
  }, [playDeafenToggle]);

  const refreshMicrophones = useCallback(async () => {
    setMicrophones(await listMicrophones());
  }, []);

  // Same reasoning as the 1:1 call: replaceTrack on each peer's existing audio
  // sender needs no renegotiation, so a mic change is seamless for everyone in
  // the channel. A failure with one peer must not stop the rest from getting
  // the new track.
  const selectMicrophone = useCallback(async (deviceId: string) => {
    const stream = localStreamRef.current;
    if (!stream) {
      setMicDeviceId(deviceId);
      return;
    }
    const track = await acquireMicTrack(deviceId);
    track.enabled = !mutedRef.current;
    for (const pc of peerConnectionsRef.current.values()) {
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) await sender.replaceTrack(track).catch(() => {});
    }
    stream.getAudioTracks().forEach((old) => {
      old.stop();
      stream.removeTrack(old);
    });
    stream.addTrack(track);
    setLocalStream(stream);
    setMicDeviceId(deviceId);
  }, []);

  const stopScreenTrack = useCallback(() => {
    const track = screenTrackRef.current;
    if (!track) return;
    track.onended = null;
    track.stop();
    localStreamRef.current?.removeTrack(track);
    screenTrackRef.current = null;
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      stopScreenTrack();
      for (const sender of videoSendersRef.current.values()) {
        await sender.replaceTrack(null).catch(() => {});
      }
      setScreenSharing(false);
      setLocalStream(localStreamRef.current);
      return;
    }

    const stream = localStreamRef.current;
    if (!stream) return; // not in a channel

    let track: MediaStreamTrack;
    try {
      track = await acquireScreenTrack();
    } catch (err) {
      if (err instanceof ScreenShareCancelledError) return;
      throw err;
    }

    // One video sender per peer, shared with the camera — starting a share
    // ends the camera rather than opening a second video m-line.
    if (cameraOn) {
      stream.getVideoTracks().forEach((t) => {
        if (t === track) return;
        t.stop();
        stream.removeTrack(t);
      });
      setCameraOn(false);
    }

    track.onended = () => {
      screenTrackRef.current = null;
      for (const sender of videoSendersRef.current.values()) {
        sender.replaceTrack(null).catch(() => {});
      }
      localStreamRef.current?.removeTrack(track);
      setScreenSharing(false);
      setLocalStream(localStreamRef.current);
    };
    screenTrackRef.current = track;

    stream.addTrack(track);
    setLocalStream(stream);

    for (const [peerCode, pc] of peerConnectionsRef.current.entries()) {
      try {
        const existing = videoSendersRef.current.get(peerCode);
        if (existing) {
          await existing.replaceTrack(track);
        } else {
          const sendOffer = (offer: RTCSessionDescriptionInit) => {
            const groupId = groupIdRef.current;
            if (!groupId) return Promise.resolve();
            return sendGroupCallOffer(groupId, myCode, peerCode, offer);
          };
          const sender = await addVideoTrackAndRenegotiate(pc, stream, track, sendOffer);
          videoSendersRef.current.set(peerCode, sender);
        }
      } catch {
        // Deliberately swallowed, matching toggleCamera: one flaky peer must
        // not stop everyone else in the channel from seeing the screen.
      }
    }
    setScreenSharing(true);
  }, [screenSharing, cameraOn, myCode, stopScreenTrack]);

  const toggleCamera = useCallback(async () => {
    // Camera and screen share the same sender, so the camera takes it back.
    if (!cameraOn && screenSharing) {
      stopScreenTrack();
      setScreenSharing(false);
    }
    if (cameraOn) {
      // Genuinely stop the track (turns the OS camera light off) and clear
      // every peer's sender via replaceTrack(null) — no renegotiation.
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });
      for (const sender of videoSendersRef.current.values()) {
        await sender.replaceTrack(null).catch(() => {});
      }
      setCameraOn(false);
      return;
    }

    if (!localStreamRef.current) return; // not in a call
    const track = await acquireCameraTrack();
    const stream = localStreamRef.current;
    // Always re-add the fresh track to the LOCAL stream, not just the peer
    // senders — turning the camera off removed the old track from `stream`
    // (so the local preview correctly goes blank), so a later re-activation
    // needs to add the new one back or the local preview would stay blank
    // forever even though remote peers correctly receive the new track via
    // replaceTrack(). addTrack() is a harmless no-op if the track is already
    // present (e.g. the very first activation, where addVideoTrackAndRenegotiate
    // below also adds it) — safe to call unconditionally either way.
    stream.addTrack(track);
    setLocalStream(stream);

    // Each peer is handled independently, and a failure with one peer must
    // not stop the others from getting the video track — a flaky connection
    // to one person shouldn't mean nobody else sees your camera.
    for (const [peerCode, pc] of peerConnectionsRef.current.entries()) {
      try {
        const existingSender = videoSendersRef.current.get(peerCode);
        if (existingSender) {
          // Already renegotiated once before (this peer had video previously,
          // then it was turned off) — just swap in the fresh track.
          await existingSender.replaceTrack(track);
        } else {
          const sendOffer = (offer: RTCSessionDescriptionInit) => {
            const groupId = groupIdRef.current;
            if (!groupId) return Promise.resolve();
            return sendGroupCallOffer(groupId, myCode, peerCode, offer);
          };
          const sender = await addVideoTrackAndRenegotiate(pc, stream, track, sendOffer);
          videoSendersRef.current.set(peerCode, sender);
        }
      } catch (err) {
        console.error(`Failed to send video to ${peerCode}:`, err);
      }
    }
    setCameraOn(true);
  }, [cameraOn, screenSharing, myCode, stopScreenTrack]);

  return (
    <GroupCallContext.Provider
      value={{
        activeGroupCall,
        peers,
        muted,
        deafened,
        cameraOn,
        screenSharing,
        microphones,
        micDeviceId,
        localStream,
        joinGroupCall,
        leaveGroupCall,
        toggleMuted,
        toggleDeafen,
        toggleCamera,
        toggleScreenShare,
        selectMicrophone,
        refreshMicrophones,
        remoteStreams,
      }}
    >
      {Object.entries(remoteStreams).map(([code, stream]) => (
        <PeerAudioSink key={code} code={code} stream={stream} deafened={deafened} />
      ))}
      {children}
    </GroupCallContext.Provider>
  );
}

export function useGroupCall() {
  const ctx = useContext(GroupCallContext);
  if (!ctx) throw new Error("useGroupCall must be used within a GroupCallProvider");
  return ctx;
}
