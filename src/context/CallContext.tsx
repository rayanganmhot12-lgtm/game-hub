"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from "react";
import {
  ICE_SERVERS,
  callConversationId,
  ringFriend,
  listenForIncomingCalls,
  clearIncomingCall,
  sendOffer,
  listenForOffer,
  sendAnswer,
  listenForAnswer,
  sendIceCandidate,
  listenForIceCandidates,
  listenForHangup,
  signalHangup,
  clearCallRoom,
  type IncomingCallPayload,
} from "@/lib/webrtc";
import { getModerationState, isRestricted } from "@/lib/moderationRealtime";
import { isFirebaseConfigured } from "@/lib/firebase";

type CallStatus = "ringing-out" | "ringing-in" | "connecting" | "connected";

interface ActiveCall {
  peerCode: string;
  peerDisplayName: string;
  convId: string;
  status: CallStatus;
  sessionId: string;
}

interface CallContextValue {
  incomingCall: IncomingCallPayload | null;
  activeCall: ActiveCall | null;
  muted: boolean;
  startCall: (peerCode: string, peerDisplayName: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  hangUp: () => void;
  toggleMuted: () => void;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ myCode, myDisplayName, children }: { myCode: string; myDisplayName: string; children: ReactNode }) {
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);
  const convIdRef = useRef<string | null>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    return listenForIncomingCalls(myCode, (call) => {
      // Ignore incoming-call notifications while already on a call.
      if (activeCallRef.current) return;
      setIncomingCall(call);
    });
  }, [myCode]);

  const cleanupCall = useCallback(() => {
    cleanupFnsRef.current.forEach((fn) => fn());
    cleanupFnsRef.current = [];
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    convIdRef.current = null;
    setActiveCall(null);
  }, []);

  const hangUp = useCallback(() => {
    if (convIdRef.current) {
      signalHangup(convIdRef.current);
      clearCallRoom(convIdRef.current);
    }
    cleanupCall();
  }, [cleanupCall]);

  const setupPeerConnection = useCallback(
    (convId: string, peerCode: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) sendIceCandidate(convId, myCode, event.candidate.toJSON());
      };

      pc.ontrack = (event) => {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
        setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : prev));
      };

      const unsubCandidates = listenForIceCandidates(convId, peerCode, (candidate) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      });
      const unsubHangup = listenForHangup(convId, () => {
        cleanupCall();
      });
      cleanupFnsRef.current.push(unsubCandidates, unsubHangup);

      return pc;
    },
    [myCode, cleanupCall]
  );

  const startCall = useCallback(
    async (peerCode: string, peerDisplayName: string) => {
      const state = await getModerationState(myCode);
      const { restricted, reason } = isRestricted(state);
      if (restricted) throw new Error(reason);
      if (!isFirebaseConfigured) throw new Error("Voice calls aren't set up yet — see the README for Firebase setup.");

      const convId = callConversationId(myCode, peerCode);
      convIdRef.current = convId;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const pc = setupPeerConnection(convId, peerCode);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendOffer(convId, myCode, offer);
      await ringFriend(peerCode, myCode, myDisplayName, convId);

      setActiveCall({ peerCode, peerDisplayName, convId, status: "ringing-out", sessionId: crypto.randomUUID() });

      const unsubAnswer = listenForAnswer(convId, async (sdp) => {
        if (!sdp || pc.currentRemoteDescription) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        setActiveCall((prev) => (prev ? { ...prev, status: "connecting" } : prev));
      });
      cleanupFnsRef.current.push(unsubAnswer);
    },
    [myCode, myDisplayName, setupPeerConnection]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const { fromCode, fromDisplayName, convId } = incomingCall;

    const state = await getModerationState(myCode);
    const { restricted, reason } = isRestricted(state);
    if (restricted) {
      setIncomingCall(null);
      clearIncomingCall(myCode);
      throw new Error(reason);
    }

    convIdRef.current = convId;
    setIncomingCall(null);
    await clearIncomingCall(myCode);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStreamRef.current = stream;

    const pc = setupPeerConnection(convId, fromCode);
    pcRef.current = pc;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    setActiveCall({
      peerCode: fromCode,
      peerDisplayName: fromDisplayName,
      convId,
      status: "connecting",
      sessionId: crypto.randomUUID(),
    });

    const unsubOffer = listenForOffer(convId, async (sdp) => {
      if (!sdp || pc.currentRemoteDescription) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendAnswer(convId, answer);
    });
    cleanupFnsRef.current.push(unsubOffer);
  }, [incomingCall, myCode, setupPeerConnection]);

  const declineCall = useCallback(() => {
    if (incomingCall) {
      signalHangup(incomingCall.convId);
      clearIncomingCall(myCode);
    }
    setIncomingCall(null);
  }, [incomingCall, myCode]);

  const toggleMuted = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
      return next;
    });
  }, []);

  return (
    <CallContext.Provider
      value={{ incomingCall, activeCall, muted, startCall, acceptCall, declineCall, hangUp, toggleMuted }}
    >
      <audio ref={remoteAudioRef} autoPlay />
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
}
