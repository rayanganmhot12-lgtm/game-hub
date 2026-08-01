"use client";

// Which kind of call is currently live — a 1:1 friend call (CallContext) or a
// server voice channel (GroupCallContext) — tracked outside React so that
// BOTH contexts can check the other one before starting anything.
//
// Why not just read the other context: `src/app/(app)/layout.tsx` nests the
// providers as <CallProvider><GroupCallProvider>…</GroupCallProvider></CallProvider>.
// GroupCallContext can therefore call useCall(), but CallContext can NOT call
// useGroupCall() — the group provider is its descendant, so its context isn't
// available where CallProvider's own logic runs. Mutual exclusion has to work
// in both directions, and a shared module-level registry keeps both sides
// symmetric instead of wiring one direction through context and the other
// through something else. A third provider wrapping both would also work, but
// every read below happens inside an imperative event handler (starting,
// accepting or joining a call), never during render, so there is nothing a
// React subscription would buy us.
//
// Safe under SSR: both flags start `false` and are only ever mutated from
// client-side call setup/teardown, which never runs during a server render.

let directCallActive = false;
let groupCallActive = false;

/** Record whether a 1:1 friend call is in progress (including while ringing). */
export function markDirectCallActive(active: boolean): void {
  directCallActive = active;
}

/** Record whether a server voice-channel call is in progress. */
export function markGroupCallActive(active: boolean): void {
  groupCallActive = active;
}

export function isDirectCallActive(): boolean {
  return directCallActive;
}

export function isGroupCallActive(): boolean {
  return groupCallActive;
}
