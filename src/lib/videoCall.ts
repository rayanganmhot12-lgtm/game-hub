"use client";

// Shared logic for adding a camera video track to an already-connected
// RTCPeerConnection and renegotiating so the remote side receives it, used
// by both GroupCallContext (server voice channels) and CallContext (1:1
// friend calls) — this file only knows WebRTC mechanics, not Firebase
// signaling paths, which the two callers still own separately.

import { getDesktopBridge } from "@/lib/desktopBridge";
import { pickScreenShareSource } from "@/lib/screenSharePicker";

export async function acquireCameraTrack(): Promise<MediaStreamTrack> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });
  } catch {
    throw new Error("Couldn't start your camera. Check that it's connected and not in use by another app.");
  }
  const track = stream.getVideoTracks()[0];
  if (!track) {
    throw new Error("No camera track was available.");
  }
  return track;
}

// Screen capture produces a video track like the camera does, so it rides the
// same sender and the same renegotiation path below — the two are deliberately
// mutually exclusive rather than opening a second video m-line.
//
// The returned track can end without the app touching it: every browser puts
// its own "Stop sharing" affordance on screen. Callers must listen for
// `ended` and reconcile their state, or the UI keeps claiming the screen is
// being shared after it has stopped.
export async function acquireScreenTrack(): Promise<MediaStreamTrack> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error("Screen sharing isn't available here.");
  }

  // In the desktop app the choice has to be made before the capture, not
  // during it. Electron has no picker of its own on Windows and rejects
  // getDisplayMedia outright unless the main process answers with a source, so
  // we show our own picker first and arm the request with the result. It also
  // keeps cancelling clean: refusing the request after the fact reaches us as
  // AbortError, which is indistinguishable from a real failure, whereas
  // closing our picker never calls getDisplayMedia at all.
  const desktop = getDesktopBridge();
  if (desktop) {
    const sources = await desktop.listScreenShareSources();
    const chosen = await pickScreenShareSource(sources);
    if (!chosen) throw new ScreenShareCancelledError();
    await desktop.selectScreenShareSource(chosen.id);
  }

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (err) {
    // In a browser, dismissing Chrome's own picker rejects with
    // NotAllowedError. That's an ordinary "changed my mind", not a fault worth
    // showing an error toast for, so it gets its own type for callers to
    // swallow.
    if (err instanceof DOMException && err.name === "NotAllowedError") {
      throw new ScreenShareCancelledError();
    }
    // Name the cause. This threw a bare sentence once, and a missing Electron
    // handler — NotSupportedError on every single press — looked exactly like
    // any other failure, which is what made it hard to place.
    const cause = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    throw new Error(`Couldn't start screen sharing (${cause}).`, { cause: err });
  }
  const track = stream.getVideoTracks()[0];
  if (!track) {
    throw new Error("No screen track was available.");
  }
  return track;
}

export class ScreenShareCancelledError extends Error {
  constructor() {
    super("Screen share cancelled");
    this.name = "ScreenShareCancelledError";
  }
}

// Only ever called once per peer connection — the FIRST time the local
// user turns their camera on. Every toggle after that (on this same peer
// connection) uses the RTCRtpSender this returns with replaceTrack()
// instead, which needs no renegotiation.
export async function addVideoTrackAndRenegotiate(
  pc: RTCPeerConnection,
  stream: MediaStream,
  track: MediaStreamTrack,
  sendOffer: (offer: RTCSessionDescriptionInit) => Promise<void>
): Promise<RTCRtpSender> {
  stream.addTrack(track);
  const sender = pc.addTrack(track, stream);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendOffer(offer);
  return sender;
}

// The old renegotiation guard checked `pc.currentRemoteDescription`
// truthiness, which stays true forever after the very first successful
// negotiation — meaning it silently discarded every later renegotiation
// offer too. Comparing the actual SDP content is how you tell "this really
// is a new offer" apart from "the same offer firing again" (Firebase's
// onValue always re-fires once immediately on subscribe with whatever
// value is already there).
export function isNewRemoteOffer(pc: RTCPeerConnection, sdp: RTCSessionDescriptionInit): boolean {
  return pc.currentRemoteDescription?.sdp !== sdp.sdp;
}
