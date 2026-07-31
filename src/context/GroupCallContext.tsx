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
  joinGroupCall: (groupId: string, groupName: string) => Promise<void>;
  leaveGroupCall: () => void;
  toggleMuted: () => void;
  toggleDeafen: () => void;
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
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  // Purely local, per-viewer preference — muting how a peer sounds to you
  // doesn't affect what anyone else hears, so no signaling needed.
  const [locallyMutedPeers, setLocallyMutedPeers] = useState<Set<string>>(new Set());

  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
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
        if (localStreamRef.current) pc.addTrack(track, localStreamRef.current);
      });

      const unsubCandidates = listenForGroupCallCandidates(groupId, peerCode, myCode, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });

      const cleanups: Array<() => void> = [unsubCandidates];

      // Deterministic tie-breaker so both sides agree on who offers —
      // avoids both peers creating competing offers at once.
      if (myCode < peerCode) {
        (async () => {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendGroupCallOffer(groupId, myCode, peerCode, offer);
        })();
        const unsubAnswer = listenForGroupCallAnswer(groupId, peerCode, myCode, async (sdp) => {
          if (pc.currentRemoteDescription) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        });
        cleanups.push(unsubAnswer);
      } else {
        const unsubOffer = listenForGroupCallOffer(groupId, peerCode, myCode, async (sdp) => {
          if (pc.currentRemoteDescription) return;
          await pc.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendGroupCallAnswer(groupId, myCode, peerCode, answer);
        });
        cleanups.push(unsubOffer);
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
        joinGroupCall,
        leaveGroupCall,
        toggleMuted,
        toggleDeafen,
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
