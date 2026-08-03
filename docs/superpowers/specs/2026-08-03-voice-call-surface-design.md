# The voice call surface

## Why

Four gaps in calls, and they are not four separate problems. Two of them need
state that does not exist yet, and building either one alone would build half
of it badly.

- **Mute and deafen are invisible to everyone else.** The participant record
  published to Firebase is `{ displayName, joinedAt }`. Mute lives entirely in
  the muting person's browser, so a silent channel is indistinguishable from a
  channel where four people are muted.
- **Nothing acknowledges the toggle.** Pressing mute changes a button's colour
  and nothing else. There is no confirmation you can hear, which is what you
  want when the button is somewhere you are not looking.
- **Per-person control exists but is unreachable from a call.**
  `locallyMutedPeers` and `toggleLocalMute` are already implemented in
  `GroupCallContext` and wired into `MemberContextMenu` — the *member list*.
  Inside the call itself, right-clicking anyone does nothing, and there is no
  per-person volume anywhere.
- **The call window cannot be moved, and does not have a fullscreen.** It is
  pinned to the top-right corner. Its expand button insets it 32px inside the
  app window, which is neither a floating window nor a fullscreen one — the
  worst use of the screen for the thing it exists to show, someone's shared
  screen.

## What changes

### 1. Mute and deafen become published state

Deafen is published alongside mute rather than folded into it. They are
different statements: someone muted may still be listening, while someone
deafened cannot hear you at all, which is the one you want to know before you
start talking to them.

**Group calls.** `GroupCallParticipant` gains `muted` and `deafened`.
`joinGroupCall` writes them with the initial values, and a new
`updateGroupCallState(groupId, code, state)` writes subsequent changes.

It must use Firebase's `update`, not `set`. `joinGroupCall` registers
`onDisconnect(myRef).remove()` on that path so a crashed client disappears
from the roster; a full `set` on every mute toggle is a needless rewrite of a
record whose other fields we are not changing, and partial updates keep the
intent obvious.

**1:1 calls.** A new branch, `calls/{convId}/state/{code}`, holding the same
two booleans, with `onDisconnect().remove()` registered on it.

Ordering matters here. `startCall` clears the whole call room before it writes
an offer — deliberately, so a previous call's stale signalling cannot bind the
new one. State must therefore be written *after* that clear, or it is erased
the moment it is set.

**Where it shows.** A badge on the avatar in the voice roster in
`GroupChannelsSidebar`, and on the participant tile in `CallWindow`. Deafened
outranks muted in the badge, since deafening already implies a muted mic.

### 2. Mute and deafen make a sound

`src/lib/sound.ts` gains four tones, built the same way as every existing one —
oscillators, no audio files. Mute is a two-note fall, unmute the same two notes
rising, and the deafen pair is lower and duller so the four are told apart
without any of them announcing themselves.

They are played through `SoundContext`, like every other sound in the app, so
the existing UI-sound toggle silences them along with the rest.

They are local. Only the person pressing the button hears the tone; a channel
where everyone hears everyone's mute clicks is noise, and the badge from
section 1 is what tells other people.

### 3. Per-person mute and volume

**One store.** A `peerAudio` map keyed by friend code, each entry
`{ muted: boolean; volume: number }`, persisted to localStorage so a person you
turned down stays turned down for the next call. The existing
`locallyMutedPeers` set folds into it — one concept, one home, rather than a
set for mute beside a map for volume.

**Volume goes to 200%.** `HTMLMediaElement.volume` is clamped to 1, so
anything above unity needs Web Audio:
`MediaStreamAudioSourceNode → GainNode → destination`, with gain from 0 to 2.

The catch worth writing down: a WebRTC `MediaStream` does not flow through
Web Audio in Chromium unless the stream is also attached to a media element.
So the per-peer `<audio>` element stays mounted and stays muted, acting purely
as the pump that makes the stream produce samples, while the gain node is the
audible output. Below 100% the result is identical to setting `volume`
directly; above it, it is real amplification.

**The menu.** A new `CallMemberMenu` — avatar, name, mute toggle, volume
slider, and nothing else — opened by right-click on a `CallWindow` tile or on
a voice-roster row in `GroupChannelsSidebar`. Right-clicking your own tile
opens nothing; there is nothing there to adjust.

`MemberContextMenu` keeps its own items (profile, mention, nickname, roles),
but its mute row and the new slider come from a shared `PeerAudioControls`
component that `CallMemberMenu` also uses, so "how loud is this person" has one
implementation rather than two that drift.

**Both call kinds.** Group peers already have their own `<audio>` elements.
The 1:1 peer's audio plays through the tile in `CallWindow`, so that path takes
the same gain treatment rather than a second mechanism.

### 4. The call window moves, and has a real fullscreen

Two states, floating and fullscreen, replacing today's three-way muddle of
pinned, inset-8, and nothing.

- **Dragging** is by the header only, so the buttons in it still work. Pointer
  events rather than mouse events, position clamped on every move and on window
  resize so the window can never be dragged or resized off-screen, and the
  final position persisted to localStorage.
- **Fullscreen** uses `element.requestFullscreen()`. A `fullscreenchange`
  listener syncs state back, because Escape is handled by the browser and never
  reaches our handler — without that listener the button would keep claiming
  the window is fullscreen after the user has already left it.
- Dragging is disabled while fullscreen.
- The old `expanded` state is deleted. With a window that moves and a real
  fullscreen, an inset-by-32px middle state has no remaining job.

## Build order

Four features is too much for one round of verification. Built and verified one
at a time, in this order:

1. **Section 4** — the only one fully verifiable without a second person.
2. **Section 2** — self-contained, no shared state.
3. **Section 1** — introduces published state.
4. **Section 3** — the most involved, and the one that benefits from the others
   being settled.

## Verification

Typecheck and lint on each. Live in the browser for everything that does not
need a second participant: dragging and its clamping, position persistence,
fullscreen entering and exiting including via Escape, the menu opening, and the
slider moving.

What cannot be verified alone, and will be reported as such rather than
claimed: that a badge appears on the *other* person's screen, and that per-peer
volume changes what a real remote stream sounds like. Both need someone else on
the line.

## Out of scope

- Push-to-talk, voice activity detection, and speaking indicators.
- Server-side mute of another person. Everything here is local to the listener
  or a statement about yourself; nobody gets to mute anyone else's microphone.
- Per-person volume for the music player. Different subsystem, different
  problem.
