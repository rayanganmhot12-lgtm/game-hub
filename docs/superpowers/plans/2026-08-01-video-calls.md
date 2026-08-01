# Video Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real camera video to both of Game Hub's existing WebRTC voice call systems (server group voice channels and 1:1 friend calls), with a Discord-style lazy camera toggle (no camera permission prompt until the user presses the camera button), and replace the current audio-only floating widgets with a shared Picture-in-Picture video call window that can expand/collapse.

**Architecture:** A new framework-agnostic helper (`src/lib/videoCall.ts`) owns the tricky part — adding a video track to an already-connected `RTCPeerConnection` and renegotiating — so `GroupCallContext` and `CallContext` each call the same logic instead of duplicating it. Both contexts also need a real signaling fix: today each peer pair has a fixed, one-directional offerer/answerer role decided once at connect time, and the answerer side has no path to send a *renegotiation* offer later, nor is anyone listening for one from them. This plan makes renegotiation bidirectional in both contexts. A new shared `CallWindow` component (replacing `GroupCallBar` and `CallBar`) renders one video (or avatar-fallback) tile per participant, with mic/camera/expand/leave controls.

**Tech Stack:** React 19 (client components), WebRTC (`RTCPeerConnection`, `getUserMedia`), Firebase Realtime Database for signaling (already wired up — no schema changes needed, since `onValue` already re-fires whenever a signaling path is overwritten with a new value).

## Global Constraints

- No test framework exists in this project (confirmed: no jest/vitest/playwright in `package.json`). Every task's "Steps" use `npx tsc --noEmit` and `npx eslint <file>` for static verification, plus a concrete manual browser check — this matches how every other feature in this project has been verified.
- Camera permission must never be requested until the user explicitly presses the camera toggle button — not at call-join time.
- Turning the camera off (or leaving the call) must call `track.stop()` on the video track, not just set `enabled = false` — the OS camera light must actually turn off.
- A renegotiation failure with one peer must never break the call for anyone else, or break the local user's own camera/mic.
- The final task requires a real two-account manual test in the browser (one session per account) — a single-session check cannot prove the video exchange works.

---

### Task 1: Shared video-track helper

**Files:**
- Create: `src/lib/videoCall.ts`

**Why `replaceTrack`, not `track.enabled`:** the spec requires the OS-level camera light to actually turn off when the camera is toggled off — that only happens when the track is genuinely `.stop()`'d, not merely `.enabled = false` (a disabled-but-unstopped track still holds the camera device open and keeps the hardware light on). But a stopped track can never be restarted; turning the camera back on needs a *fresh* track from a new `getUserMedia` call. Re-adding that fresh track with `pc.addTrack()` again would require a *second* renegotiation every single toggle, contradicting "every toggle after the first is cheap." The fix: the very first camera-on keeps `pc.addTrack()` (one real renegotiation, creating a video "sender"/m-line that exists for the rest of the call), and every toggle after that — on or off — calls `RTCRtpSender.replaceTrack()` on that same sender, which swaps or clears the track **without any renegotiation at all**. This is the standard WebRTC mechanism for exactly this "mute my camera" scenario.

**Interfaces:**
- Produces: `acquireCameraTrack(): Promise<MediaStreamTrack>` — requests camera permission and returns a fresh video track, or throws a user-readable `Error` on denial/no-camera. Called every time the camera turns on (first time and every time after), since a previously-stopped track can't be reused.
- Produces: `addVideoTrackAndRenegotiate(pc: RTCPeerConnection, stream: MediaStream, track: MediaStreamTrack, sendOffer: (offer: RTCSessionDescriptionInit) => Promise<void>): Promise<RTCRtpSender>` — used only the *first* time the camera turns on for a given peer connection. Adds `track` to `stream` (so the remote side's `ontrack` groups it with the existing audio track) and to `pc`, renegotiates, and returns the `RTCRtpSender` so the caller can hold onto it for all future toggles.
- Produces: `isNewRemoteOffer(pc: RTCPeerConnection, sdp: RTCSessionDescriptionInit): boolean` — true if `sdp` is actually different from whatever remote description `pc` currently holds (compares `.sdp` string content), used everywhere the old code checked `pc.currentRemoteDescription` truthiness — that check blocked all renegotiation because it stayed true forever after the first successful connection.

- [ ] **Step 1: Create the file**

```ts
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
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit` and `npx eslint src/lib/videoCall.ts`
Expected: both clean, no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/videoCall.ts
git commit -m "Add shared WebRTC video-track helper for camera renegotiation"
```

---

### Task 2: Add camera support to GroupCallContext (server voice channels)

**Files:**
- Modify: `src/context/GroupCallContext.tsx`

**Interfaces:**
- Consumes: `acquireCameraTrack`, `addVideoTrackAndRenegotiate`, `isNewRemoteOffer` from `src/lib/videoCall.ts` (Task 1).
- Produces (added to `GroupCallContextValue`): `cameraOn: boolean`, `toggleCamera: () => Promise<void>`, `localStream: MediaStream | null`, `remoteStreams: Record<string, MediaStream>` (already existed — now may also carry a video track per peer, no signature change).

**Root cause being fixed:** `connectToPeer` gives each pair of peers a fixed, one-directional role via `if (myCode < peerCode)` — one side always offers, the other always answers, for the entire life of that peer connection. If the *answerer* is the one who turns their camera on, they have no signaling path to send a new offer that the *offerer* side is listening for (the offerer only ever set up an answer-listener, never an offer-listener). This task makes every peer connection listen for a *possible* renegotiation offer from the other side regardless of original role, and answer it — while leaving the original offerer/answerer tie-break exactly as-is for the *initial* connection (so there's no new "glare" risk on first connect).

- [ ] **Step 1: Read the current file to confirm line numbers haven't shifted**

Run: `grep -n "connectToPeer\|joinGroupCall\|GroupCallContextValue\|localStreamRef" src/context/GroupCallContext.tsx`

- [ ] **Step 2: Add the video imports and new context fields**

In `src/context/GroupCallContext.tsx`, add this import alongside the existing ones from `@/lib/groupCallRealtime`:

```ts
import { acquireCameraTrack, addVideoTrackAndRenegotiate, isNewRemoteOffer } from "@/lib/videoCall";
```

Extend the `GroupCallContextValue` interface:

```ts
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
```

Add new state inside `GroupCallProvider`, next to the existing `useState` calls:

```ts
const [cameraOn, setCameraOn] = useState(false);
const [localStream, setLocalStream] = useState<MediaStream | null>(null);
```

Add a new ref next to `peerConnectionsRef`, tracking each peer's video `RTCRtpSender` once one exists (created either by an initial connect that already had an active camera, or by the first camera-on toggle) — every toggle after that reuses the same sender via `replaceTrack()` instead of renegotiating again:

```ts
const videoSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
```

- [ ] **Step 3: Make `connectToPeer` listen for renegotiation offers on both sides, and track a video sender if the camera is already on**

Replace the body of `connectToPeer` (the `if (myCode < peerCode) { ... } else { ... }` block and everything below it up to `peerCleanupRef.current.set(...)`) with:

```ts
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
```

Note: this introduces a second, *mirrored* pair of listeners so each side can both send and receive offers/answers for renegotiation, while the original tie-break still decides who sends the very first offer. `pc.signalingState === "stable"` is the standard WebRTC way to check "no negotiation is currently in flight" before applying a new remote description, replacing the old permanent `pc.currentRemoteDescription` truthiness check.

- [ ] **Step 4: Clean up `videoSendersRef` when a peer disconnects**

In `disconnectFromPeer`, right after `peerConnectionsRef.current.delete(peerCode);`, add:

```ts
videoSendersRef.current.delete(peerCode);
```

- [ ] **Step 5: Add the camera toggle function**

Add this alongside `toggleMuted`/`toggleDeafen`. Each peer either already has a video sender (from a previous toggle, or from connecting while the camera was already on) — in which case this just swaps the track on it with no renegotiation — or doesn't yet, in which case this is the first time and a real renegotiation is needed:

```ts
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
```

Note: a single acquired `MediaStreamTrack` is reused across every peer's `replaceTrack`/`addTrack` call in the loop above — one camera capture serves every connection, not one per peer.

- [ ] **Step 6: Expose the new fields, reset camera state on join/leave, and set `localStream` on join**

In `joinGroupCall`, right after `localStreamRef.current = stream;`, add:

```ts
setLocalStream(stream);
```

In `leaveGroupCall`, right after `localStreamRef.current?.getTracks().forEach((t) => t.stop());`, add:

```ts
setCameraOn(false);
setLocalStream(null);
videoSendersRef.current.clear();
```

Update the context provider's `value` object to include the new fields:

```tsx
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
```

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit` and `npx eslint src/context/GroupCallContext.tsx`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/context/GroupCallContext.tsx
git commit -m "Add camera toggle and bidirectional renegotiation to group voice calls"
```

---

### Task 3: Add camera support to CallContext (1:1 friend calls)

**Files:**
- Modify: `src/context/CallContext.tsx`

**Interfaces:**
- Consumes: `acquireCameraTrack`, `addVideoTrackAndRenegotiate`, `isNewRemoteOffer` from `src/lib/videoCall.ts` (Task 1).
- Produces (added to `CallContextValue`): `cameraOn: boolean`, `toggleCamera: () => Promise<void>`, `localStream: MediaStream | null`, `remoteStream: MediaStream | null` (new — the existing code only ever attached the remote stream directly to a hidden `<audio>` element via a ref; the new `CallWindow` UI in Task 4 needs the `MediaStream` object itself to bind to a `<video>` element).

**Root cause being fixed:** same asymmetry as Task 2, but sharper here — this system has exactly one fixed offerer (whoever calls `startCall`) and one fixed answerer (whoever calls `acceptCall`), with only ONE signaling path each way (`calls/{convId}/offer` and `calls/{convId}/answer` — not per-direction like the group system). The caller (`startCall`) currently never sets up an offer-listener at all, so if the *callee* turns their camera on and sends a renegotiation offer, nobody on the caller's side is listening for it.

- [ ] **Step 1: Read the current file to confirm line numbers haven't shifted**

Run: `grep -n "setupPeerConnection\|startCall\|acceptCall\|CallContextValue\|localStreamRef\|remoteAudioRef" src/context/CallContext.tsx`

- [ ] **Step 2: Add imports and new state**

Add this import:

```ts
import { acquireCameraTrack, addVideoTrackAndRenegotiate, isNewRemoteOffer } from "@/lib/videoCall";
```

Extend `CallContextValue`:

```ts
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
```

Add new state inside `CallProvider`:

```ts
const [cameraOn, setCameraOn] = useState(false);
const [localStream, setLocalStream] = useState<MediaStream | null>(null);
const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
```

- [ ] **Step 3: Track the remote stream as state, not just a ref-bound `<audio>` element**

In `setupPeerConnection`'s `pc.ontrack` handler, replace:

```ts
pc.ontrack = (event) => {
  if (remoteAudioRef.current) {
    remoteAudioRef.current.srcObject = event.streams[0];
  }
  setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : prev));
};
```

with:

```ts
pc.ontrack = (event) => {
  setRemoteStream(event.streams[0]);
  setActiveCall((prev) => (prev ? { ...prev, status: "connected" } : prev));
};
```

(The hidden `<audio>` element and `remoteAudioRef` are removed in Step 6 below — `CallWindow`, built in Task 4, plays audio+video together through a `<video>` element bound to this same `remoteStream`.)

- [ ] **Step 4: Make the caller ALSO listen for a later renegotiation offer**

In `startCall`, right after the existing `listenForAnswer` subscription block, add a second subscription:

```ts
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
```

(This replaces the existing `if (!sdp || pc.currentRemoteDescription) return;` guard inside the original `listenForAnswer` callback with the `pc.signalingState === "stable"` check — same reasoning as Task 2: `currentRemoteDescription` stays truthy forever after the first successful answer, silently blocking a later legitimate one, whereas `signalingState` correctly reflects "is a negotiation currently resolved" at any point in the call.)

- [ ] **Step 5: Make the callee's existing offer-listener support later offers too, and add a renegotiation-answer listener**

In `acceptCall`, replace:

```ts
const unsubOffer = listenForOffer(convId, async (sdp) => {
  if (!sdp || pc.currentRemoteDescription) return;
  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await sendAnswer(convId, answer);
});
cleanupFnsRef.current.push(unsubOffer);
```

with:

```ts
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
```

(`have-local-offer` is included in the guard here because the very first offer processed by the callee legitimately arrives while the connection is still in its initial state, not yet "stable" — this mirrors the original code's behavior for the first offer while still allowing a later one once the call is `stable`.)

- [ ] **Step 6: Add the camera toggle, remove the now-unused `remoteAudioRef`/`<audio>` element**

Remove `const remoteAudioRef = useRef<HTMLAudioElement | null>(null);` and the `<audio ref={remoteAudioRef} autoPlay />` element in the provider's JSX (Task 4's `CallWindow` renders a `<video>` bound to `remoteStream` instead, which also plays audio).

Add a new ref next to `pcRef`, holding the video sender once one exists (same `replaceTrack()`-after-the-first-renegotiation reasoning as Task 2, just for a single peer instead of a map):

```ts
const videoSenderRef = useRef<RTCRtpSender | null>(null);
```

Add the toggle function next to `toggleMuted`:

```ts
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
```

Set `localStream` when the call starts — in `startCall` and `acceptCall`, right after `localStreamRef.current = stream;`, add `setLocalStream(stream);` in both places.

Reset camera state in `cleanupCall`, right after `localStreamRef.current = null;`, add:

```ts
setCameraOn(false);
setLocalStream(null);
setRemoteStream(null);
videoSenderRef.current = null;
```

- [ ] **Step 7: Update the provider's `value` and JSX**

```tsx
return (
  <CallContext.Provider
    value={{ incomingCall, activeCall, muted, cameraOn, localStream, remoteStream, startCall, acceptCall, declineCall, hangUp, toggleMuted, toggleCamera }}
  >
    {children}
  </CallContext.Provider>
);
```

- [ ] **Step 8: Type-check and lint**

Run: `npx tsc --noEmit` and `npx eslint src/context/CallContext.tsx`
Expected: both clean.

- [ ] **Step 9: Commit**

```bash
git add src/context/CallContext.tsx
git commit -m "Add camera toggle and bidirectional renegotiation to 1:1 calls"
```

---

### Task 4: Shared PiP video call window

**Files:**
- Create: `src/components/CallWindow.tsx`
- Delete: `src/components/GroupCallBar.tsx` (its `JoinVoiceButton` export was already removed from use by the earlier voice-channel-row fix; grep to confirm nothing still imports it before deleting)
- Delete: `src/components/CallBar.tsx`

**Interfaces:**
- Consumes: `useGroupCall()` (Task 2), `useCall()` (Task 3), `ProfileAvatar` (already exists in `src/components/ProfileAvatar.tsx`).
- Produces: default export `CallWindow` — a single component that renders nothing if neither call system has an active call, otherwise renders the PiP window for whichever one is active (a user cannot be in both at once in this app's existing call-start logic, since starting either kind of call doesn't check for an active call of the *other* kind — out of scope for this plan to prevent, but in practice `GroupCallBar` and `CallBar` already coexisted with the same non-enforcement, so this isn't a new gap).

- [ ] **Step 1: Confirm nothing besides the app layout imports the two components being deleted**

Run: `grep -rn "GroupCallBar\|CallBar" src/ --include=*.tsx --include=*.ts | grep -v "GroupCallContext\|CallContext\|CallWindow"`
Expected: only `src/app/(app)/layout.tsx` (handled in Task 5).

- [ ] **Step 2: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Maximize2, Minimize2 } from "lucide-react";
import { useGroupCall } from "@/context/GroupCallContext";
import { useCall } from "@/context/CallContext";
import { useToast } from "@/context/ToastContext";
import ProfileAvatar from "@/components/ProfileAvatar";

interface Tile {
  code: string;
  displayName: string;
  stream: MediaStream | null;
}

// Whether a tile should show live video is NOT the same question as
// "does a video track object currently exist on this stream" — turning a
// camera off calls RTCRtpSender.replaceTrack(null) rather than removing
// the track from the connection (so no renegotiation is needed to turn it
// back on), and the *receiving* side's track object doesn't disappear when
// that happens — it just stops getting real frames. The standards-correct
// signal for "is this track actually receiving/producing frames right
// now" is the track's own `mute`/`unmute` events and its `.muted`
// property, which is what this hook watches instead of track presence.
function useTrackLive(stream: MediaStream | null): boolean {
  const [live, setLive] = useState(false);

  useEffect(() => {
    const track = stream?.getVideoTracks()[0];
    if (!track) {
      setLive(false);
      return;
    }
    setLive(!track.muted);
    const handleMute = () => setLive(false);
    const handleUnmute = () => setLive(true);
    track.addEventListener("mute", handleMute);
    track.addEventListener("unmute", handleUnmute);
    return () => {
      track.removeEventListener("mute", handleMute);
      track.removeEventListener("unmute", handleUnmute);
    };
  }, [stream]);

  return live;
}

function VideoTile({ tile }: { tile: Tile }) {
  const live = useTrackLive(tile.stream);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg bg-surface-2">
      {live && tile.stream ? (
        <video
          autoPlay
          playsInline
          muted={false}
          ref={(el) => {
            if (el && el.srcObject !== tile.stream) el.srcObject = tile.stream;
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <ProfileAvatar code={tile.code} displayName={tile.displayName} size={56} />
      )}
      <span className="absolute bottom-1 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
        {tile.displayName}
      </span>
    </div>
  );
}

export default function CallWindow() {
  const group = useGroupCall();
  const direct = useCall();
  const { showToast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [togglingCamera, setTogglingCamera] = useState(false);

  const inGroupCall = Boolean(group.activeGroupCall);
  // Ringing states (outgoing/incoming, not yet connected) are intentionally
  // excluded — that UI is IncomingCallBanner's job (Task 5), unaffected by
  // this plan. CallWindow only takes over once a direct call is actually
  // connecting/connected, same scope as the old CallBar's "active" branch.
  const inDirectCall = Boolean(direct.activeCall) && direct.activeCall?.status !== "ringing-out" && direct.activeCall?.status !== "ringing-in";

  if (!inGroupCall && !inDirectCall) return null;

  const isGroup = inGroupCall;
  const title = isGroup ? group.activeGroupCall!.groupName : direct.activeCall!.peerDisplayName;
  const muted = isGroup ? group.muted : direct.muted;
  const cameraOn = isGroup ? group.cameraOn : direct.cameraOn;
  const localStream = isGroup ? group.localStream : direct.localStream;

  const tiles: Tile[] = isGroup
    ? group.peers.map((p) => ({ code: p.code, displayName: p.displayName, stream: group.remoteStreams[p.code] ?? null }))
    : direct.activeCall
      ? [{ code: direct.activeCall.peerCode, displayName: direct.activeCall.peerDisplayName, stream: direct.remoteStream }]
      : [];

  async function handleToggleCamera() {
    setTogglingCamera(true);
    try {
      if (isGroup) await group.toggleCamera();
      else await direct.toggleCamera();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't toggle camera.", "error");
    } finally {
      setTogglingCamera(false);
    }
  }

  function handleToggleMuted() {
    if (isGroup) group.toggleMuted();
    else direct.toggleMuted();
  }

  function handleLeave() {
    if (isGroup) group.leaveGroupCall();
    else direct.hangUp();
  }

  return (
    <AnimatePresence>
      <motion.div
        key="call-window"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        className={`fixed z-50 flex flex-col gap-2 rounded-2xl border border-border bg-surface/95 p-3 shadow-2xl backdrop-blur-xl transition-all ${
          expanded ? "inset-8" : "right-4 top-4 w-[min(360px,calc(100%-2rem))]"
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          <button onClick={() => setExpanded((v) => !v)} title={expanded ? "Collapse" : "Expand"} className="rounded-full p-1.5 text-muted hover:text-foreground">
            {expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        <div className={`grid flex-1 gap-2 overflow-y-auto ${expanded ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-1"}`}>
          <VideoTile tile={{ code: "me", displayName: "You", stream: localStream }} />
          {tiles.map((t) => (
            <VideoTile key={t.code} tile={t} />
          ))}
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            onClick={handleToggleMuted}
            title={muted ? "Unmute" : "Mute"}
            className={`rounded-full p-2.5 transition-transform duration-100 active:scale-90 ${muted ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <button
            onClick={handleToggleCamera}
            disabled={togglingCamera}
            title={cameraOn ? "Turn camera off" : "Turn camera on"}
            className={`rounded-full p-2.5 transition-transform duration-100 active:scale-90 disabled:opacity-50 ${cameraOn ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"}`}
          >
            {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
          </button>
          <button
            onClick={handleLeave}
            title="Leave"
            className="rounded-full bg-red-500/15 p-2.5 text-red-400 transition-transform duration-100 hover:bg-red-500/25 active:scale-90"
          >
            <PhoneOff size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

Note: incoming-call ringing (accept/decline UI) and outgoing "Ringing…" status previously lived inside `CallBar`'s first two branches — those are **not** reproduced here since this plan is scoped to the connected-call video experience. Task 5 keeps a minimal ringing notification alive so accepting/declining calls still works; see Task 5 Step 2.

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit` and `npx eslint src/components/CallWindow.tsx`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/CallWindow.tsx
git commit -m "Add shared PiP video call window for group and 1:1 calls"
```

---

### Task 5: Wire CallWindow into the app, keep incoming-call ringing UI, verify end-to-end

**Files:**
- Modify: `src/app/(app)/layout.tsx`
- Create: `src/components/IncomingCallBanner.tsx` (the small piece of the old `CallBar` — incoming/outgoing ringing UI — that `CallWindow` intentionally didn't reproduce)
- Delete: `src/components/GroupCallBar.tsx`, `src/components/CallBar.tsx`

**Interfaces:**
- Consumes: `useCall()` (ringing state only), `CallWindow` (Task 4).

- [ ] **Step 1: Create the incoming-call banner (extracted from the old CallBar's first two branches)**

```tsx
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, PhoneOff } from "lucide-react";
import { useCall } from "@/context/CallContext";
import { useToast } from "@/context/ToastContext";
import { useSound } from "@/context/SoundContext";

const STATUS_LABEL: Record<string, string> = {
  "ringing-out": "Ringing…",
  "ringing-in": "Incoming call",
};

export default function IncomingCallBanner() {
  const { incomingCall, activeCall, acceptCall, declineCall, hangUp } = useCall();
  const { showToast } = useToast();
  const { playRingtone } = useSound();
  const [busy, setBusy] = useState(false);

  const isRinging = (Boolean(incomingCall) && !activeCall) || activeCall?.status === "ringing-out";

  useEffect(() => {
    if (!isRinging) return;
    const stopRingtone = playRingtone();
    return stopRingtone;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRinging]);

  async function handleAccept() {
    setBusy(true);
    try {
      await acceptCall();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't accept call.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {incomingCall && !activeCall ? (
        <motion.div
          key="incoming"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(360px,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-black">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent-bright/50" />
            <Phone size={18} className="relative" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{incomingCall.fromDisplayName}</p>
            <p className="text-xs text-muted">Incoming voice call…</p>
          </div>
          <button
            onClick={declineCall}
            disabled={busy}
            title="Decline"
            className="rounded-full bg-red-500/15 p-2.5 text-red-400 transition-transform duration-100 hover:bg-red-500/25 active:scale-90"
          >
            <PhoneOff size={16} />
          </button>
          <button
            onClick={handleAccept}
            disabled={busy}
            title="Accept"
            className="rounded-full bg-emerald-500/15 p-2.5 text-emerald-400 transition-transform duration-100 hover:bg-emerald-500/25 active:scale-90"
          >
            <Phone size={16} />
          </button>
        </motion.div>
      ) : activeCall?.status === "ringing-out" ? (
        <motion.div
          key="ringing-out"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          className="fixed inset-x-0 top-4 z-50 mx-auto flex w-[min(360px,calc(100%-2rem))] items-center gap-3 rounded-2xl border border-border bg-surface/95 p-4 shadow-2xl backdrop-blur-xl"
        >
          <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-black">
            <span className="absolute inset-0 animate-ping rounded-full bg-accent-bright/50" />
            <Phone size={18} className="relative" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{activeCall.peerDisplayName}</p>
            <p className="text-xs text-muted">{STATUS_LABEL["ringing-out"]}</p>
          </div>
          <button
            onClick={hangUp}
            title="Cancel"
            className="rounded-full bg-red-500/15 p-2.5 text-red-400 transition-transform duration-100 hover:bg-red-500/25 active:scale-90"
          >
            <PhoneOff size={16} />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Update the app layout**

In `src/app/(app)/layout.tsx`, replace:

```ts
import CallBar from "@/components/CallBar";
import GroupCallBar from "@/components/GroupCallBar";
```

with:

```ts
import CallWindow from "@/components/CallWindow";
import IncomingCallBanner from "@/components/IncomingCallBanner";
```

Replace the render lines:

```tsx
<CallBar />
<GroupCallBar />
```

with:

```tsx
<IncomingCallBanner />
<CallWindow />
```

- [ ] **Step 3: Delete the old components**

```bash
git rm src/components/CallBar.tsx src/components/GroupCallBar.tsx
```

- [ ] **Step 4: Type-check and lint the whole project**

Run: `npx tsc --noEmit` and `npx eslint .`
Expected: both clean.

- [ ] **Step 5: Manual two-account verification**

This is the only reliable way to verify WebRTC renegotiation actually works — do this with two real logged-in sessions (two browser profiles, or two accounts on two machines):

1. Both accounts join the same server's voice channel (or start a 1:1 call with each other).
2. Confirm audio works both directions exactly as before (this plan must not have regressed the existing audio behavior).
3. Account A presses the camera button. Confirm: A's own camera light turns on, A sees their own video tile, and **B sees A's video tile update from an avatar to live video** without B doing anything.
4. Account B presses the camera button. Confirm B's own camera turns on and **A sees B's video** too (this is the direction that was structurally broken before this plan's signaling fix, if B was the answerer/callee).
5. Either account turns their camera off. Confirm their camera's OS-level light actually turns off (not just the tile reverting to an avatar) and the other side's tile correctly reverts to the avatar fallback.
6. Press "Expand" — confirm the window grows and the grid layout still shows all tiles. Press "Collapse" — confirm it returns to the small floating size. The rest of the app must remain usable/navigable in both states.
7. Leave the call from either side — confirm the other side's connection cleans up (no lingering video tile, no stuck camera light).

- [ ] **Step 6: Commit**

```bash
git add src/app/(app)/layout.tsx src/components/IncomingCallBanner.tsx
git commit -m "Wire up shared PiP CallWindow, remove old audio-only call bars"
```
