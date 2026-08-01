"use client";

// Shared logic for adding a camera video track to an already-connected
// RTCPeerConnection and renegotiating so the remote side receives it, used
// by both GroupCallContext (server voice channels) and CallContext (1:1
// friend calls) — this file only knows WebRTC mechanics, not Firebase
// signaling paths, which the two callers still own separately.

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
