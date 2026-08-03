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
  setCallState,
  listenForCallState,
  type IncomingCallPayload,
} from "@/lib/webrtc";
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
import { isGroupCallActive, markDirectCallActive } from "@/lib/callActivity";
import { useSound } from "@/context/SoundContext";
import PeerAudioSink from "@/components/PeerAudioSink";

type CallStatus = "ringing-out" | "ringing-in" | "connecting" | "connected";

// CallWindow renders exactly one call mode and gives group calls priority, and
// CallContext no longer renders an <audio> element of its own (Task 3 made the
// 1:1 video tile the sole playback sink). A 1:1 call running alongside a group
// call would therefore be invisible, inaudible and un-hangup-able. Rather than
// render both at once, the two call types are kept mutually exclusive at the
// entry points — matching this app's existing "one call at a time" model.
const IN_GROUP_CALL_ERROR = "You're already in a voice channel — leave it first to start a call.";
const IN_GROUP_CALL_ANSWER_ERROR = "You're already in a voice channel — leave it first to answer a call.";

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
  /** Whether the person on the other end has their microphone muted. */
  peerMuted: boolean;
  cameraOn: boolean;
  screenSharing: boolean;
  microphones: MicrophoneOption[];
  micDeviceId: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  startCall: (peerCode: string, peerDisplayName: string) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => void;
  hangUp: () => void;
  toggleMuted: () => void;
  toggleCamera: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  selectMicrophone: (deviceId: string) => Promise<void>;
  refreshMicrophones: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ myCode, myDisplayName, children }: { myCode: string; myDisplayName: string; children: ReactNode }) {
  // There is no deafen in a 1:1 call — it exists only for server voice, in
  // ServerUserPanel — so only the mic pair is used here.
  const { playMicToggle } = useSound();
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [muted, setMuted] = useState(false);
  const [peerMuted, setPeerMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [microphones, setMicrophones] = useState<MicrophoneOption[]>([]);
  const [micDeviceId, setMicDeviceId] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  // The screen track ends whenever the user stops sharing from the browser's
  // own bar, so its listener has to be removable when we stop it ourselves.
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cleanupFnsRef = useRef<Array<() => void>>([]);
  const convIdRef = useRef<string | null>(null);
  const activeCallRef = useRef<ActiveCall | null>(null);
  // Mirrors `muted` so switching microphones can carry the mute state onto the
  // replacement track without making selectMicrophone depend on it.
  const mutedRef = useRef(false);
  // Read when a call starts, so a mic chosen before or during a previous call
  // is the one that opens on the next one instead of the system default.
  const micDeviceIdRef = useRef<string | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  // Publishing is an effect rather than lines inside startCall and acceptCall:
  // both paths converge on the same activeCall, so doing it here means neither
  // can forget, and it re-publishes on every toggle for free. It also lands
  // after startCall's deliberate room clear, which would otherwise wipe it.
  useEffect(() => {
    const convId = activeCall?.convId;
    if (!convId) return;
    setCallState(convId, myCode, { muted }).catch(() => {
      // An out-of-date icon on the other end is not worth breaking a call over.
    });
  }, [activeCall?.convId, myCode, muted]);

  useEffect(() => {
    if (!activeCall) return;
    const unsubscribe = listenForCallState(activeCall.convId, activeCall.peerCode, (state) =>
      setPeerMuted(state?.muted ?? false)
    );
    return () => {
      unsubscribe();
      // Cleared on the way out, or the next call would open showing the last
      // person's mute state.
      setPeerMuted(false);
    };
  }, [activeCall?.convId, activeCall?.peerCode, activeCall]);

  useEffect(() => {
    micDeviceIdRef.current = micDeviceId;
  }, [micDeviceId]);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    return listenForIncomingCalls(myCode, (call) => {
      // Ignore incoming-call notifications while already on a call — either a
      // 1:1 call or a server voice channel. Ringing during a group call would
      // offer an Accept button that acceptCall() now refuses anyway.
      if (activeCallRef.current || isGroupCallActive()) return;
      setIncomingCall(call);
    });
  }, [myCode]);

  const cleanupCall = useCallback(() => {
    try {
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
    } finally {
      // Released in `finally` so a throw from any earlier teardown step (a
      // Firebase off(), pc.close(), a track stop()) can never leak the claim.
      // A leaked flag is invisible and unrecoverable without a hard reload:
      // it blocks every future call, and a leaked GROUP flag would make the
      // incoming-ring check above drop 1:1 calls with no user feedback at all.
      markDirectCallActive(false);
    }
  }, []);

  const hangUp = useCallback(() => {
    if (convIdRef.current) {
      signalHangup(convIdRef.current);
      clearCallRoom(convIdRef.current);
    }
    cleanupCall();
  }, [cleanupCall]);

  // The providers live in `src/app/(app)/layout.tsx`, so a client-side
  // navigation OUT of the (app) route group — "Recap" (/recap), "Big Picture"
  // (/big-picture), or logout's router.push("/") — unmounts them while a call
  // can still be live. Without this the module-level claim in lib/callActivity
  // outlives React and stays set for the rest of the page session.
  //
  // `hangUp` rather than `cleanupCall`: it is the same teardown a normal
  // hang-up performs, so the peer is actually told the call ended instead of
  // being stranded in a dead call, and it is safe when idle (the signalling is
  // guarded by convIdRef, and cleanupCall no-ops on empty refs). Both
  // `cleanupCall` and `hangUp` are useCallbacks with stable identities (deps
  // `[]` and `[cleanupCall]`), so this effect mounts and unmounts exactly once
  // — putting a non-stable callback here would tear down a LIVE call every
  // time its identity changed.
  useEffect(() => {
    return () => {
      hangUp();
    };
  }, [hangUp]);

  const setupPeerConnection = useCallback(
    (convId: string, peerCode: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) sendIceCandidate(convId, myCode, event.candidate.toJSON());
      };

      pc.ontrack = (event) => {
        // Publish a NEW MediaStream identity wrapping the same tracks rather
        // than `event.streams[0]` itself. When the peer turns their camera on
        // mid-call the video track arrives on the SAME stream id the audio
        // track came in on, so the browser hands back the very same
        // MediaStream object it gave us originally — `setRemoteStream` would
        // hit React's Object.is bailout and CallWindow would never re-render
        // to notice that a video track now exists. Wrapping the same tracks
        // keeps playback and the tracks' own mute/unmute events intact while
        // guaranteeing the re-render.
        setRemoteStream(new MediaStream(event.streams[0].getTracks()));
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

  // Handles every remote offer for a 1:1 call — the callee's initial offer and
  // both sides' later renegotiation offers (camera toggles).
  //
  // Unlike the group system, which has a separate signaling path per direction,
  // 1:1 offers all share ONE `calls/{convId}/offer` slot written with `set()`.
  // Two consequences have to be handled here:
  //
  //  1. Your own offers echo straight back at you, so they must be dropped by
  //     writer code. (Previously nothing did this: only the `stable` guard
  //     happened to keep a self-offer from being applied, which stops being
  //     true the moment we start rolling back during glare.)
  //  2. Simultaneous camera toggles overwrite each other, so one side's offer
  //     can be destroyed in the database before the other side ever sees it.
  //
  // The tiebreak reuses the `myCode < peerCode` convention that
  // GroupCallContext.connectToPeer already uses to pick an initial offerer, so
  // "lower code leads" holds across both call systems.
  const createRemoteOfferHandler = useCallback(
    (pc: RTCPeerConnection, convId: string, peerCode: string) =>
      async (sdp: RTCSessionDescriptionInit | null, fromCode: string | null) => {
        if (!sdp || fromCode === myCode) return; // our own offer echoing back
        if (!isNewRemoteOffer(pc, sdp)) return;

        if (pc.signalingState !== "stable") {
          // Glare: our own offer is still in flight and a conflicting one
          // just arrived. Anything other than have-local-offer (e.g. already
          // mid-answer) isn't glare and isn't ours to resolve.
          if (pc.signalingState !== "have-local-offer") return;

          if (myCode < peerCode) {
            // Impolite side: our offer wins. It cannot simply be ignored,
            // though — the peer's write just overwrote ours in the shared
            // slot, so there is nothing left in the database for them to
            // answer and BOTH sides would sit in have-local-offer forever,
            // which is the permanent two-way wedge this fixes. Re-publish our
            // offer so the polite side has something to roll back to and
            // answer. Only this side ever re-publishes, so it settles in one
            // round with no ping-pong.
            const localOffer = pc.localDescription;
            if (localOffer) await sendOffer(convId, myCode, { type: localOffer.type, sdp: localOffer.sdp });
            return;
          }

          // Polite side: drop our own in-flight offer and take theirs instead.
          // Rollback returns us to `stable`; the video track we added before
          // offering stays on the connection, so the answer below can still
          // carry it.
          await pc.setLocalDescription({ type: "rollback" });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendAnswer(convId, answer);
      },
    [myCode]
  );

  const startCall = useCallback(
    async (peerCode: string, peerDisplayName: string) => {
      if (isGroupCallActive()) throw new Error(IN_GROUP_CALL_ERROR);
      // Claim the "a 1:1 call is in progress" slot before the first await:
      // setup below waits on getUserMedia, which can sit on a browser
      // permission prompt for seconds — easily long enough for the user to
      // click a voice channel and end up in both call types at once, which is
      // exactly what this mutual exclusion exists to prevent.
      markDirectCallActive(true);
      let established = false;
      try {
        const state = await getModerationState(myCode);
        const { restricted, reason } = isRestricted(state);
        if (restricted) throw new Error(reason);
        if (!isFirebaseConfigured) throw new Error("Voice calls aren't set up yet — see the README for Firebase setup.");

        const convId = callConversationId(myCode, peerCode);
        convIdRef.current = convId;

        // The room id is derived from the two friend codes, so the same
        // Firebase path is reused for every call this pair ever makes. Only
        // hangUp() cleared it, which means a declined call — or a closed
        // window, a refresh, a dropped connection — left the previous offer,
        // answer and ICE candidates sitting there.
        //
        // Firebase's onValue fires immediately on subscribe with whatever is
        // already at the path, so on the next call the listeners registered
        // below would receive that stale answer before the real one arrived
        // and bind this connection to a finished session. The call then never
        // completes and nothing visibly happens when the other side accepts.
        //
        // Clearing before anything is written or subscribed guarantees each
        // call starts from an empty room regardless of how the last one ended.
        await clearCallRoom(convId);

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: micDeviceIdRef.current ? { deviceId: { exact: micDeviceIdRef.current } } : true,
        });
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
        established = true;

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
        const unsubRenegotiationOffer = listenForOffer(convId, createRemoteOfferHandler(pc, convId, peerCode));
        cleanupFnsRef.current.push(unsubRenegotiationOffer);
      } catch (err) {
        // Release the claim only if no call actually came up — once
        // setActiveCall has run, hangUp/cleanupCall owns releasing it.
        if (!established) markDirectCallActive(false);
        throw err;
      }
    },
    [myCode, myDisplayName, setupPeerConnection, createRemoteOfferHandler]
  );

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    if (isGroupCallActive()) throw new Error(IN_GROUP_CALL_ANSWER_ERROR);
    const { fromCode, fromDisplayName, convId } = incomingCall;

    // Same up-front claim as startCall — see the comment there.
    markDirectCallActive(true);
    let established = false;
    try {
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

      const stream = await navigator.mediaDevices.getUserMedia({
          audio: micDeviceIdRef.current ? { deviceId: { exact: micDeviceIdRef.current } } : true,
        });
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
      established = true;

      const unsubOffer = listenForOffer(convId, createRemoteOfferHandler(pc, convId, fromCode));
      cleanupFnsRef.current.push(unsubOffer);

      // The callee also needs a way to send their OWN renegotiation offer later
      // (if they turn their camera on) — the caller's mirror listener added in
      // Task 3 Step 4 is what receives it.
      const unsubRenegotiationAnswerAck = listenForAnswer(convId, async (sdp) => {
        if (!sdp || pc.signalingState === "stable") return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      });
      cleanupFnsRef.current.push(unsubRenegotiationAnswerAck);
    } catch (err) {
      if (!established) markDirectCallActive(false);
      throw err;
    }
  }, [incomingCall, myCode, setupPeerConnection, createRemoteOfferHandler]);

  const declineCall = useCallback(() => {
    if (incomingCall) {
      signalHangup(incomingCall.convId);
      clearIncomingCall(myCode);
      // Declining left the caller's offer in the shared room. startCall now
      // clears before dialling, so this is belt-and-braces rather than the
      // only defence — but leaving a dead offer published is what made the
      // next call between these two silently fail to connect.
      clearCallRoom(incomingCall.convId);
    }
    setIncomingCall(null);
  }, [incomingCall, myCode]);

  const toggleMuted = useCallback(() => {
    // From the ref rather than the updater: the sound has to be chosen once,
    // and setState updaters can run more than once for a single call.
    playMicToggle(!mutedRef.current);
    setMuted((prev) => {
      const next = !prev;
      localStreamRef.current?.getAudioTracks().forEach((track) => (track.enabled = !next));
      return next;
    });
  }, [playMicToggle]);

  const refreshMicrophones = useCallback(async () => {
    setMicrophones(await listMicrophones());
  }, []);

  // Swapping the live audio track through the existing sender, rather than
  // rebuilding the stream, is what makes this safe mid-call: the sender and
  // its m-line are untouched, so there is nothing to renegotiate and the
  // remote side hears the new mic without a blip.
  const selectMicrophone = useCallback(
    async (deviceId: string) => {
      const pc = pcRef.current;
      const stream = localStreamRef.current;
      if (!pc || !stream) {
        // Not in a call — remember the choice for the next one.
        setMicDeviceId(deviceId);
        return;
      }
      const track = await acquireMicTrack(deviceId);
      // Carry the current mute state over, or switching mics would silently
      // un-mute someone who is muted.
      track.enabled = !mutedRef.current;
      const sender = pc.getSenders().find((s) => s.track?.kind === "audio");
      if (sender) {
        await sender.replaceTrack(track);
      }
      stream.getAudioTracks().forEach((old) => {
        old.stop();
        stream.removeTrack(old);
      });
      stream.addTrack(track);
      setLocalStream(stream);
      setMicDeviceId(deviceId);
    },
    []
  );

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
      if (videoSenderRef.current) await videoSenderRef.current.replaceTrack(null).catch(() => {});
      setScreenSharing(false);
      setLocalStream(localStreamRef.current);
      return;
    }

    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return; // not in a call

    let track: MediaStreamTrack;
    try {
      track = await acquireScreenTrack();
    } catch (err) {
      // Dismissing the OS picker is a decision, not a failure.
      if (err instanceof ScreenShareCancelledError) return;
      throw err;
    }

    // Camera and screen share the one video sender, so starting a share ends
    // the camera rather than opening a second video m-line.
    if (cameraOn) {
      stream.getVideoTracks().forEach((t) => {
        if (t === track) return;
        t.stop();
        stream.removeTrack(t);
      });
      setCameraOn(false);
    }

    // Whatever the browser's own "Stop sharing" button does has to be
    // reflected back here, or the button keeps claiming you're sharing.
    track.onended = () => {
      screenTrackRef.current = null;
      videoSenderRef.current?.replaceTrack(null).catch(() => {});
      localStreamRef.current?.removeTrack(track);
      setScreenSharing(false);
      setLocalStream(localStreamRef.current);
    };
    screenTrackRef.current = track;

    try {
      stream.addTrack(track);
      setLocalStream(stream);
      if (videoSenderRef.current) {
        await videoSenderRef.current.replaceTrack(track);
      } else {
        const convId = convIdRef.current;
        const sendOfferFn = (offer: RTCSessionDescriptionInit) => {
          if (!convId) return Promise.resolve();
          return sendOffer(convId, myCode, offer);
        };
        videoSenderRef.current = await addVideoTrackAndRenegotiate(pc, stream, track, sendOfferFn);
      }
      setScreenSharing(true);
    } catch (err) {
      // Same rollback reasoning as the camera: one peer, so a failed
      // renegotiation leaves nothing worth keeping, and an orphaned track
      // would keep the "sharing your screen" indicator up.
      const orphanSender = pc.getSenders().find((s) => s.track === track);
      stopScreenTrack();
      if (orphanSender && pc.signalingState !== "closed") pc.removeTrack(orphanSender);
      throw err;
    }
  }, [screenSharing, cameraOn, myCode, stopScreenTrack]);

  const toggleCamera = useCallback(async () => {
    // Both ride the single video sender, so the camera takes it back.
    if (!cameraOn && screenSharing) {
      stopScreenTrack();
      setScreenSharing(false);
    }
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
    try {
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
    } catch (err) {
      // Roll the whole toggle back. GroupCallContext swallows a per-peer
      // failure and still turns the camera on, because the OTHER peers must
      // keep working; here there is exactly one peer, so if renegotiating with
      // them fails there is nothing left to salvage. Without this the track
      // stays attached with `cameraOn` still reporting false — a stuck-on
      // camera light, and the next button press would acquire a SECOND camera
      // track on top of it.
      const orphanSender = pc.getSenders().find((s) => s.track === track);
      track.stop();
      stream.removeTrack(track);
      // Detach the half-added sender too, so that a later retry's
      // pc.addTrack() reuses this now-trackless transceiver instead of adding
      // a duplicate video m-line.
      if (orphanSender && pc.signalingState !== "closed") pc.removeTrack(orphanSender);
      // CallWindow's handleToggleCamera surfaces this via its existing toast,
      // and its own setTogglingCamera(false) re-render is what clears the
      // now-trackless local tile back to the avatar.
      throw err;
    }
  }, [cameraOn, screenSharing, myCode, stopScreenTrack]);

  return (
    <CallContext.Provider
      value={{
        incomingCall,
        activeCall,
        muted,
        peerMuted,
        cameraOn,
        screenSharing,
        microphones,
        micDeviceId,
        localStream,
        remoteStream,
        startCall,
        acceptCall,
        declineCall,
        hangUp,
        toggleMuted,
        toggleCamera,
        toggleScreenShare,
        selectMicrophone,
        refreshMicrophones,
      }}
    >
      {/* The peer's audio used to ride the video tile in CallWindow, which
          meant it existed only while their camera was on and needed a second
          fallback element for when it wasn't. One sink, mounted for the whole
          call, is both simpler and the only way per-person volume can apply
          regardless of camera state. */}
      {activeCall && <PeerAudioSink code={activeCall.peerCode} stream={remoteStream} />}
      {children}
    </CallContext.Provider>
  );
}

export function useCall() {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error("useCall must be used within a CallProvider");
  return ctx;
}
