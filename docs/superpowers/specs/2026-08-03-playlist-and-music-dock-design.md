# Playlist page and music dock redesign

## Why

The music bar and the Playlist page are the last two surfaces the recent design
pass never reached, and it shows.

The bar is a two-row strip wedged between the navbar and the page, carrying a
title, four transport buttons, a volume control and a scrubber in a space too
small for any of them. Its two `<input type="range">` elements are unstyled —
the only browser-default chrome left anywhere in the app, sitting a few pixels
below a navbar with a gradient wordmark. Its timestamps are 10px. And because
it is `position: fixed` under the navbar, three separate columns have to pad
their tops around it.

The Playlist page renders every track as an identical bordered card with a
permanent 36px accent play button. Twelve tracks read as twelve unrelated
objects all shouting at the same volume. The page never states how many tracks
there are, how long they run, or which one is playing beyond a faint border
tint. `sizeBytes` and `uploadedAt` already come back from the API and are
thrown away.

## What changes

### 1. The bar becomes a bottom dock

`MusicPlayerBar` moves from `fixed top-16` to `fixed bottom-0`, full width, and
collapses from two cramped rows to one composed row with three zones:

- **Identity (left).** A 44px tile with an accent gradient, standing in for the
  cover art these tracks do not have. It holds an animated four-bar equalizer
  while playing and a static `Music2` glyph while paused. Beside it, the track
  title links to `/playlist`, with a small line beneath reading `Track 3 of 12`.
- **Transport (centre).** `shuffle · prev · play/pause · next`, the play button
  a larger accent circle, and directly beneath them the scrubber: elapsed time,
  slider, duration. The scrubber becomes the widest element in the dock.
- **Volume (right).** Mute toggle plus volume slider, hidden below `sm` exactly
  as today.

A hairline accent line along the dock's top edge tracks playback position, so
progress is legible without reading the scrubber.

**The autoplay-blocked banner is deleted.** Today it is a separate
`fixed inset-x-0 top-0 z-40` bar that paints over the navbar. The dock absorbs
the state instead: the play button pulses and the subtitle line reads
`Click to start music`. One fewer floating layer.

The measure-and-publish `ResizeObserver` effect that sets `--music-bar-height`
is unchanged, including clearing the property when the playlist is empty and
the dock renders nothing.

### 2. Sliders get a real primitive

A `.slider` class in `globals.css` styles `::-webkit-slider-runnable-track` and
`::-webkit-slider-thumb`: a 4px rounded track, a small thumb that grows on
hover, and a filled portion drawn as a `linear-gradient` hard stop driven by a
`--fill` custom property the component sets from its own value. Everything
derives from `--accent-rgb`, so it re-themes with the accent picker and the
Dark Red theme without per-theme rules.

Applied to both dock sliders and to the one in the theme editor — that is the
app's only other range input, and leaving it as browser chrome while styling
its siblings would be the same inconsistency this change exists to remove.

### 3. Layout consumers flip from top to bottom

`--music-bar-height` is read in three places today, all as top padding, plus
one hard-coded bottom offset:

Writing an abbreviated class name here would be a mistake: Tailwind v4 scans
this file too, and a placeholder inside square brackets becomes a real — and
invalid — utility in the generated stylesheet. So, in prose:

- `src/app/(app)/layout.tsx`, the `<main>` element: the variable moves out of
  its top padding and into its bottom padding, at the same 1rem / 1.5rem base.
- `src/components/Sidebar.tsx`: the `<nav>` drops back to a plain top padding,
  and the `UserPanel` wrapper below it picks up the variable in its bottom
  padding instead.
- `src/components/ServerRail.tsx`: same swap — plain top padding, variable
  bottom padding, at its 0.75rem base.
- `src/context/ToastContext.tsx`: the hard-coded `bottom-16` becomes the same
  1rem-plus-variable expression the others use.

The dock spans the full width, so the two sticky full-height columns need the
clearance at their bottoms or their last rows sit behind it. Toasts were
already parked at a hard-coded `bottom-16` with nothing beneath them; tying
them to the same variable makes them float above the dock when it exists and
drop when it does not.

`CallWindow` (`z-50`, user-dragged) and `IncomingCallBanner` (`z-50`, `top-4`)
both sit above the dock's `z-30` and need no change.

### 4. The Playlist page becomes a library

`PlaylistManager` is rebuilt around the list rather than around the cards:

- **One panel holds every row**, instead of each row carrying its own border.
- **The row opens with its track number** in tabular figures, which swaps to a
  play button on hover and to an animated equalizer when that track is the
  current one. This is what removes the permanent accent circle from every row.
- **Title centre, duration right**, tabular and muted.
- **Admin controls appear on hover only** — drag handle, up/down, delete. An
  idle list is numbers, titles and durations, nothing else.
- **The header states the collection**: `12 tracks · 47 min` as a chip beside
  the page title.
- Row height drops from roughly 60px to roughly 44px, so more of the playlist
  is visible at once.

Drag-to-reorder, the up/down buttons, upload with progress, delete, and the
empty state all keep their current behaviour. The drag handle stays admin-only
and stays the drag affordance; hover only changes whether it is painted.

### 5. Durations

A `useTrackDurations(tracks)` hook, colocated with the playlist component:

- For each track without a cached duration, create an `Audio` element with
  `preload="metadata"` pointed at `/api/playlist/{id}/file` and resolve on
  `loadedmetadata`.
- Results are cached per track id in a ref, so re-renders and reorders never
  re-probe.
- At most three probes run concurrently.
- A track whose metadata has not arrived, or whose probe errors, renders `—`.
- The header total sums only known durations.

The file route already answers Range requests, so `preload="metadata"` fetches
the header rather than the whole file. No schema migration, and it works for
the bundled tracks that were never uploaded through this app.

## Out of scope

- No `duration` column on `Track`. Deliberate: the client probe covers existing
  and bundled tracks with no backfill.
- No artist, album or cover art. The data does not exist and inventing a schema
  for it is a different project.
- No file-drop upload on the page. It would compete with row drag-to-reorder
  for the same gesture.

## Verification

- `npx tsc --noEmit` and `npm run lint` clean.
- Live on `localhost:3000`:
  - The dock renders at the bottom with all three zones, styled sliders, and
    the top progress line advancing.
  - Playlist rows show numbers, titles and resolved durations; the header chip
    states count and total.
  - Hovering a row swaps its number for a play button and reveals the admin
    controls; the current row shows the equalizer.
  - No dead band at the top of any page.
  - Sidebar's user panel, ServerRail's last icon, and a toast are all fully
    visible with the dock present.
- Screenshot of the Playlist page with the dock.
