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
  setCallPresence,
  clearCallPresence,
  type GroupCallParticipant,
} from "@/lib/groupCallRealtime";
import { getModerationState, isRestricted } from "@/lib/moderationRealtime";
import { isFirebaseConfigured } from "@/lib/firebase";
import { acquireCameraTrack, addVideoTrackAndRenegotiate, isNewRemoteOffer } from "@/lib/videoCall";

interface GroupCallPeer {
  code: string;
  displayName: string;
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
  localStream: MediaStream | null;
  joinGroupCall: (groupId: string, groupName: string) => Promise<void>;
  leaveGroupCall: () => void;
  toggleMuted: () => void;
  toggleDeafen: () => void;
  toggleCamera: () => Promise<void>;
  remoteStreams: Record<string, MediaStream>;
  locallyMutedPeers: Set<string>;
  toggleLocalMute: (peerCode: string) => void;
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
  const [activeGroupCall, setActiveGroupCall] = useState<ActiveGroupCall | null>(null);
  const [peers, setPeers] = useState<GroupCallPeer[]>([]);
  const [muted, setMuted] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  // Purely local, per-viewer preference — muting how a peer sounds to you
  // doesn't affect what anyone else hears, so no signaling needed.
  const [locallyMutedPeers, setLocallyMutedPeers] = useState<Set<string>>(new Set());

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const peerCleanupRef = useRef<Map<string, Array<() => void>>>(new Map());
  const groupIdRef = useRef<string | null>(null);
  const unsubParticipantsRef = useRef<(() => void) | null>(null);
  // Mirrors `muted` for use inside callbacks (joinGroupCall, toggleDeafen)
  // without recreating them on every mute toggle.
  const mutedRef = useRef(false);
  // What mic-mute state to restore once the user un-deafens.
  const mutedBeforeDeafenRef = useRef(false);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

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
    // Mute/deafen are treated as a standing preference, not per-call state —
    // matches Discord, where leaving a call doesn't silently unmute you.
  }, [myCode, disconnectFromPeer]);

  const joinGroupCall = useCallback(
    async (groupId: string, groupName: string) => {
      const state = await getModerationState(myCode);
      const { restricted, reason } = isRestricted(state);
      if (restricted) throw new Error(reason);
      if (!isFirebaseConfigured) throw new Error("Voice calls aren't set up yet — see the README for Firebase setup.");

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Carry the standing mute preference into the fresh track — otherwise
      // a pre-set mute would silently stop applying on your next call.
      stream.getAudioTracks().forEach((track) => (track.enabled = !mutedRef.current));
      localStreamRef.current = stream;
      setLocalStream(stream);
      groupIdRef.current = groupId;

      await joinGroupCallRealtime(groupId, myCode, myDisplayName);
      await setCallPresence(myCode, groupId, groupName);
      setActiveGroupCall({ groupId, groupName, sessionId: crypto.randomUUID() });

      unsubParticipantsRef.current = listenForGroupCallParticipants(
        groupId,
        (participants: Array<GroupCallParticipant & { code: string }>) => {
          const codes = new Set(participants.map((p) => p.code));
          setPeers(participants.filter((p) => p.code !== myCode).map((p) => ({ code: p.code, displayName: p.displayName })));

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
    },
    [myCode, myDisplayName, connectToPeer, disconnectFromPeer]
  );

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
      return next;
    });
    // Unmuting while deafened also restores hearing — same as Discord,
    // where reaching for your mic implies you want back into the call.
    setDeafened((prev) => (prev ? false : prev));
  }, []);

  const toggleDeafen = useCallback(() => {
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
  }, []);

  const toggleCamera = useCallback(async () => {
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
  }, [cameraOn, myCode]);

  const toggleLocalMute = useCallback((peerCode: string) => {
    setLocallyMutedPeers((prev) => {
      const next = new Set(prev);
      if (next.has(peerCode)) next.delete(peerCode);
      else next.add(peerCode);
      return next;
    });
  }, []);

  return (
    <GroupCallContext.Provider
      value={{
        activeGroupCall,
        peers,
        muted,
        deafened,
        cameraOn,
        localStream,
        joinGroupCall,
        leaveGroupCall,
        toggleMuted,
        toggleDeafen,
        toggleCamera,
        remoteStreams,
        locallyMutedPeers,
        toggleLocalMute,
      }}
    >
      {Object.entries(remoteStreams).map(([code, stream]) => (
        <audio
          key={code}
          autoPlay
          muted={deafened || locallyMutedPeers.has(code)}
          ref={(el) => {
            if (el) el.srcObject = stream;
          }}
        />
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
