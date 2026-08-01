# Video Calls — Design Spec

Date: 2026-08-01

## Goal

Add real camera video to Game Hub's existing WebRTC voice call systems — both server group voice channels (`GroupCallContext`) and direct friend-to-friend calls (`CallContext`) — with a Discord-style camera toggle, and replace the current small audio-only floating widget with a Picture-in-Picture (PiP) video window that can expand to a larger view.

## Current State

Both call systems are audio-only today:
- `getUserMedia({ audio: true })` only — no video track is ever requested.
- `GroupCallBar.tsx` renders a small pill widget with peer names as text and a generic icon — no per-person video or image tiles.
- Mute is implemented by toggling `track.enabled` on the existing audio track; there is no equivalent for video since no video track exists.
- Signaling (offer/answer/ICE candidate exchange) goes through Firebase Realtime Database paths, one initial offer/answer per call in `GroupCallContext`, and the answer-side listener currently guards against re-processing with `if (pc.currentRemoteDescription) return;` — this only handles the very first negotiation, not a later renegotiation.

## Shared Video Logic

Both `GroupCallContext.tsx` and `CallContext.tsx` get their own copy of near-identical new logic (camera acquisition, adding the track, triggering renegotiation, listening for renegotiation offers). To avoid the same non-trivial WebRTC renegotiation code existing in two places, a shared helper module (e.g. `src/lib/videoCall.ts`) owns:

- `acquireCameraTrack(): Promise<MediaStreamTrack>` — calls `getUserMedia({ video: true })`, throws a clear error on permission denial or no camera device.
- `addVideoTrackAndRenegotiate(pc: RTCPeerConnection, track: MediaStreamTrack, sendOffer: (offer) => Promise<void>)` — adds the track via `pc.addTrack()`, creates a fresh offer, sets it as local description, and sends it through whichever signaling function the caller (group or 1:1) provides. This keeps the renegotiation mechanics in one place while each context supplies its own Firebase signaling functions.

## Camera Toggle Behavior

Per-call, lazy camera activation (matches Discord, chosen over the simpler-but-less-accurate "request camera at join time" alternative):

1. Joining a call requests audio only, exactly as today — no camera permission prompt.
2. First time the user presses the camera button: request camera permission, add the video track to every existing peer connection, and renegotiate once per existing peer (via the shared helper above). If permission is denied or no camera exists, show a toast ("Couldn't start your camera") and leave the call running audio-only — this never breaks the call.
3. Every toggle after that (on this same call) is cheap: `track.enabled = true/false`, exactly like the existing mute mechanism — no further renegotiation.
4. A peer who joins the call *after* the local user already turned their camera on receives the video track automatically as part of the normal initial offer/answer for that peer — nothing extra needed on the sender's side.
5. If enabling the camera for one specific peer's connection fails (e.g. a mid-call renegotiation error with just that one peer), only that peer's connection is affected — the call and the local camera keep working for everyone else.
6. Leaving the call or explicitly turning the camera off calls `track.stop()` (not just `enabled = false`) so the OS-level camera indicator actually turns off.

## Renegotiation Signaling

The existing "ignore if `pc.currentRemoteDescription` is already set" guard on the offer listener must be relaxed so a genuine renegotiation offer (arriving after the initial handshake) is processed — `setRemoteDescription` + `createAnswer` handle renegotiation correctly on their own; the guard was only ever needed to avoid reprocessing the identical initial offer from the same Firebase listener firing more than once. The fix distinguishes "duplicate of what's already applied" from "a genuinely new offer" (e.g. by comparing SDP content or a per-offer counter/timestamp written alongside the offer), rather than blocking every offer once *any* remote description exists.

## PiP Call Window

A new shared component replaces `GroupCallBar` for both call systems (group and 1:1 use the same visual component; group calls just render more tiles):

- Small floating window, positioned like the current widget, draggable.
- One tile per participant (including the local user): their live `<video>` element if camera is on, otherwise their `ProfileAvatar` (real photo, falling back to initials) in a circle — reusing the component already built for showing real photos elsewhere.
- Group calls lay tiles out in a simple grid; 1:1 calls show exactly two tiles.
- Control bar: mic mute toggle (existing), camera toggle (new), expand/collapse toggle (new), leave call (existing).
- Expand makes the window take up substantially more of the screen; collapse returns it to the small floating size. Either size keeps the rest of the app usable and navigable — this is never a full-screen takeover.

## Error Handling Summary

- Camera permission denied / no camera: toast, call continues audio-only for that user.
- Renegotiation failure with one peer: only that peer's tile has no video; call continues for everyone else.
- Camera stays genuinely off (track stopped, not just hidden) whenever toggled off or the call ends.

## Testing

This is the project's first real video feature. Verification requires two real logged-in sessions (two browser profiles or two accounts) actually exchanging video, not just a single-session check — following the same two-account verification pattern already used for the original audio call feature.

## Out of Scope

- Screen sharing (visible in the reference screenshot's control bar but not requested here).
- Recording calls.
- Changing the existing mute/deafen audio behavior.
