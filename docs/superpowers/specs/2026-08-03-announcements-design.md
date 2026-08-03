# Announcements

## Why

The announcement is how the developer reaches everyone using Game Hub at once,
and both ends of it are broken in ways that defeat the point.

**The message cannot be read.** The banner renders it with `truncate` — one
line, then cut. The single thing the feature exists to deliver is the single
thing the recipient cannot see all of. It then auto-dismisses after five
seconds.

**"Send to All" does not send to all.** `handleAnnounceAll` iterates the
sender's `friends` list. Anyone who has the app but is not on that list
receives nothing, while the button promises everyone.

Smaller, but the same shape of problem: the composer is a one-line `<input>`
for something displayed as a headline, with no preview and no length limit; two
announcements arriving close together destroy each other, because
`setAnnouncement` replaces rather than queues; and a broadcast is never written
to the moderation action log, although the targeted message right beside it is.

## What changes

### 1. A real broadcast channel

A new path, `announcements/global`, pushed to once and listened to by every
client.

The existing `announcements/{code}` path stays. The moderation panel's targeted
message to one person uses it, and that is a different feature. The banner
listens to both.

The shared node changes what dismissal means. A client must never remove a
global announcement, because that would dismiss it for everyone — so **dismissal
becomes local state**: a set of announcement ids in localStorage. Targeted
announcements keep deleting themselves on dismiss, which is correct for a node
addressed to one recipient.

Two consequences have to be handled explicitly:

- **`onChildAdded` fires for every existing child on first subscribe.** With no
  bound, a client opening for the first time is hit with the entire history at
  once. The bound is `limitToLast(20)`, then a client-side filter on a 24-hour
  freshness window and the seen set. Someone who was closed for an hour still
  gets the announcement; someone away for a week is not buried in dead news.
- **Nodes would accumulate forever.** The sender prunes global children older
  than the window on each send. One-sided cleanup, needing no extra
  permissions.

The sender receives their own broadcast along with everyone else. It first
carried a `fromCode` so a client could skip its own, on the reasoning that you
know what you sent — but that left no way to see what everyone else was
actually shown, which is the thing you most want to check right after sending.

The project's Firebase database runs in test mode (see the README's setup
step), so the new path needs no security rule change.

### 2. The banner

- **The whole message**, wrapped, no truncation, with a maximum height and
  internal scrolling for anything very long.
- **A duration that fits the message**: eight seconds, plus a quarter second per
  word, capped at thirty. A two-word notice should not sit for fifteen seconds,
  and a paragraph should not vanish in five.
- **The countdown pauses on hover**, so reading it is not a race.
- **A draining accent bar along the bottom edge** replaces the numeric badge.
  For a duration that now varies and is longer, a bar reads at a glance where a
  number applies pressure.
- **Announcements queue instead of overwriting.** Today the second one replaces
  the first before it has been read. The banner holds a list, shows the head,
  and shows "1 of 3" while others are waiting.

### 3. The composer

- A `textarea` instead of a one-line input, with a 280-character limit and a
  live counter.
- A **live preview** of the banner exactly as it will arrive.
- The button states its reach — "Send to everyone" — behind a confirmation
  step, because the action is irreversible and reaches every install.
- The broadcast is **written to the moderation action log**, which the targeted
  message already does and this never did.

## Components

- `AnnouncementCard` — the appearance, and nothing else. Used by the live banner
  and by the composer's preview, so the preview cannot drift from what is
  actually delivered.
- `AnnouncementBanner` — the queue, the timer, and dismissal.
- `announcementRealtime.ts` — gains sending, listening and pruning for the
  global path alongside the existing per-code functions.
- A small module owning the seen-ids set in localStorage, bounded so it cannot
  grow without limit.

## Verification

Typecheck and lint.

Checkable in the app: the preview, the character counter, the length-derived
duration, the pause on hover, the queue counter with more than one announcement,
and that a dismissed announcement stays dismissed across a reload.

Since the sender sees their own broadcast, sending one and watching it arrive
is checkable with a single client.

**Not checkable alone:** that a broadcast reaches a *second* client. That needs
the two-client setup — the desktop app signed in as one account and a browser
at localhost:3000 signed in as another.

## Out of scope

- Scheduling or recalling an announcement.
- Severity levels or required acknowledgement. Considered and dropped: an
  announcement that everyone must click through is a different, heavier feature
  than a broadcast notice.
- Rich text, links, or images in the message.
