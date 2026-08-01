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
import { acquireCameraTrack, addVideoTrackAndRenegotiate, isNewRemoteOffer } from "@/lib/videoCall";

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
  cameraOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (peerCode: string, peerDisplayName: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  hangUp: () => void;
  toggleMuted: () => void;
  toggleCamera: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ myCode, myDisplayName, children }: { myCode: string; myDisplayName: string; children: ReactNode }) {
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
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
    setCameraOn(false);
    setLocalStream(null);
    setRemoteStream(null);
    videoSenderRef.current = null;
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
        setRemoteStream(event.streams[0]);
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
      setLocalStream(stream);

      const pc = setupPeerConnection(convId, peerCode);
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendOffer(convId, myCode, offer);
      await ringFriend(peerCode, myCode, myDisplayName, convId);

      setActiveCall({ peerCode, peerDisplayName, convId, status: "ringing-out", sessionId: crypto.randomUUID() });

      const unsubAnswer = listenForAnswer(convId, async (sdp) => {
        if (!sdp || pc.signalingState === "stable") return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        setActiveCall((prev) => (prev ? { ...prev, status: "connecting" } : prev));
      });
      cleanupFnsRef.current.push(unsubAnswer);

      // The caller only ever sent the initial offer and listened for the
      // answer — if the CALLEE later turns their camera on, they need to send
      // a fresh offer of their own, and nobody was listening for it. This
      // makes the caller side also able to receive and answer a later offer.
      const unsubRenegotiationOffer = listenForOffer(convId, async (sdp) => {
        if (!sdp || !isNewRemoteOffer(pc, sdp)) return;
        if (pc.signalingState !== "stable") return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendAnswer(convId, answer);
      });
      cleanupFnsRef.current.push(unsubRenegotiationOffer);
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
    setLocalStream(stream);

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
      if (!sdp || !isNewRemoteOffer(pc, sdp)) return;
      if (pc.signalingState !== "stable" && pc.signalingState !== "have-local-offer") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendAnswer(convId, answer);
    });
    cleanupFnsRef.current.push(unsubOffer);

    // The callee also needs a way to send their OWN renegotiation offer later
    // (if they turn their camera on) — the caller's mirror listener added in
    // Task 3 Step 4 is what receives it.
    const unsubRenegotiationAnswerAck = listenForAnswer(convId, async (sdp) => {
      if (!sdp || pc.signalingState === "stable") return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    });
    cleanupFnsRef.current.push(unsubRenegotiationAnswerAck);
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

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      // Genuinely stop the track (turns the OS camera light off) and clear
      // the sender via replaceTrack(null) — no renegotiation needed.
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.stop();
        localStreamRef.current?.removeTrack(track);
      });
      if (videoSenderRef.current) {
        await videoSenderRef.current.replaceTrack(null).catch(() => {});
      }
      setCameraOn(false);
      return;
    }

    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return; // not in a call
    const track = await acquireCameraTrack();
    // Always re-add the fresh track to the LOCAL stream (turning the camera
    // off removed the old one, so the local preview would otherwise stay
    // blank on a second activation even though the remote side correctly
    // gets the new track via replaceTrack()). Harmless no-op on the very
    // first activation, where addVideoTrackAndRenegotiate also adds it.
    stream.addTrack(track);
    setLocalStream(stream);

    if (videoSenderRef.current) {
      // Already renegotiated once before (camera was on earlier this same
      // call, then turned off) — just swap in the fresh track.
      await videoSenderRef.current.replaceTrack(track);
    } else {
      const convId = convIdRef.current;
      const sendOfferFn = (offer: RTCSessionDescriptionInit) => {
        if (!convId) return Promise.resolve();
        return sendOffer(convId, myCode, offer);
      };
      videoSenderRef.current = await addVideoTrackAndRenegotiate(pc, stream, track, sendOfferFn);
    }
    setCameraOn(true);
  }, [cameraOn, myCode]);

  return (
    <CallContext.Provider
      value={{ incomingCall, activeCall, muted, cameraOn, localStream, remoteStream, startCall, acceptCall, declineCall, hangUp, toggleMuted, toggleCamera }}
    >
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
}
