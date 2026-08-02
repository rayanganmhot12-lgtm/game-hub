# Admin Panel Design Spec

Date: 2026-08-02

## Goal

Add an admin-only "Admin" tab to the existing Moderation page, giving the
developer account (the single account matching `ADMIN_EMAIL`) two new
abilities: an animated two-color gradient effect for their own display name,
and the power to grant or revoke the "DEV" and a new "ADMIN" badge to any
other user by friend code — visible to everyone who views that person,
without ever touching that person's own local database (since this app is
local-first and every install owns its own SQLite database).

## Current State

- `/moderation` (`src/app/(app)/moderation/page.tsx`) already redirects any
  non-admin to `/dashboard` (`isAdminEmail(user.email)` check) — the whole
  page is already admin-only. It renders a single `ModerationPanel`
  component (`src/components/ModerationPanel.tsx`, 425 lines) with no tabs:
  a target-by-friend-code input, warn/mute/timeout/ban buttons, a
  moderation log, and a broadcast-announcement section.
- Badges are a single-select cosmetic: `User.equippedBadge` (nullable
  string) is the one badge a person can have showing at a time — there is
  no concept of multiple simultaneous badges. `CosmeticFrame.tsx`'s
  `BADGE_LABELS` map defines the known badge ids and their label/className;
  `"badge-developer"` ("DEV") already exists there, reserved and
  `adminOnly: true` in `COSMETIC_CATALOG` (`src/lib/cosmetics.ts`) — never
  purchasable, hidden from the Store, auto-granted once to the admin
  account via `ensureDevBadge()` (`src/lib/devBadge.ts`), called from the
  app layout. `"badge-hellokitty"` is a normal purchasable Store badge, not
  admin-exclusive.
- This app is local-first: every installation has its own SQLite database,
  and there is no shared backend beyond a Firebase Realtime Database relay.
  Existing admin-vs-other-user actions (warn, mute, timeout, ban) already
  solve exactly this cross-install problem
  (`src/lib/moderationRealtime.ts`): the admin calls
  `setModerationState(targetCode, state)`, which writes to
  `moderation/{code}` in Firebase; the target's own client independently
  listens to (`listenToModerationState`) or reads
  (`getModerationState`) that same path and enforces it — the admin's
  action never touches the target's local database, because it can't.
- Each installation also publishes a live snapshot of its own profile to
  `profiles/{code}` in Firebase (`src/lib/profileRealtime.ts`,
  `publishMyProfile`), including `badge`, `frame`, `banner`, `accentColor`,
  etc. `ProfilePublisher.tsx` (mounted globally in the app layout) re-calls
  `publishMyProfile` with a full snapshot every time any of these fields
  changes on the current user's own account. `fetchProfile(code)` is what
  other installs call to read someone else's live profile — used today by
  `FriendProfileModal` and `GroupMembersList`'s per-member profile fetch.
  Because `ProfilePublisher` re-publishes the target's *own* `badge` value
  on every one of their own profile changes, writing an admin-granted badge
  directly into `profiles/{code}.badge` would get silently overwritten the
  next time the target's own client re-publishes — the same reason
  moderation state lives at its own separate `moderation/{code}` path
  instead of inside `profiles/{code}`.
- Chat message headers (just redesigned) and the Friends list read badges
  from locally-cached roster/friend rows (`GroupMember.memberBadge`,
  `Friend.friendBadge`), not live from `profiles/{code}` — these only
  refresh when the person rejoins or re-syncs, an existing staleness
  characteristic of the app already tolerated for any badge change, not
  something this feature introduces.

## 1. Admin Tab on the Moderation Page

`ModerationPage` passes a `tab` query param or local state through to a
restructured panel: two tabs, "Actions" (today's existing warn/mute/
timeout/ban/log/announcement content, unchanged) and "Admin" (new). Both
tabs live on the same `/moderation` route — no new route. The Admin tab
contains the two features below, stacked vertically.

## 2. Animated Gradient Name (self only)

- New nullable field `User.nameEffect` (string, e.g. `"gradient-cycle"`),
  following the exact same pattern as `equippedFrame`/`equippedBadge`.
- The Admin tab shows a single On/Off toggle ("Animated Name"). Toggling
  calls a new admin-gated API route that sets `nameEffect` to
  `"gradient-cycle"` or `null` on the current (admin) user's own row.
- A new CSS class (e.g. `.name-gradient-cycle`) added to `globals.css`,
  following the existing pattern used by `.banner-aurora::after` — a
  `background: linear-gradient(...)` between two fixed, hand-picked colors,
  `background-clip: text`, `-webkit-text-fill-color: transparent`,
  `background-size` wider than 100%, animated via `@keyframes` shifting
  `background-position` continuously. Not a color picker — one built-in
  effect, matching the "two colors, the color moves" request exactly, no
  customization UI.
- Applied in two places: (a) the admin's own local UI — `AppLayout` already
  has `user.nameEffect` server-side, so it's passed down to wherever the
  admin's own name renders locally (Navbar, Sidebar's `UserPanel`) the same
  way `equippedBadge`/`equippedFrame` already are; (b) published as part of
  the existing `ProfilePublisher` snapshot (`nameEffect` added to both the
  `PublicProfile` interface and the props/payload) so anyone viewing the
  admin's `FriendProfileModal` sees the animated name too. Extending it to
  every other name-display surface (chat headers, member lists) is out of
  scope for the same staleness reasons badges already accept below.

## 3. DEV / ADMIN Badge Grant and Revoke

- Add `"badge-admin"` to `BADGE_LABELS` in `CosmeticFrame.tsx` (label
  `"ADMIN"`, its own distinct `className` styled analogously to
  `.badge-developer` but visually distinct — e.g. a different accent hue)
  and to `COSMETIC_CATALOG` in `cosmetics.ts` (`adminOnly: true`, `cost: 0`,
  never purchasable, hidden from the Store — mirroring `badge-developer`
  exactly). These two badges (`badge-developer`, `badge-admin`) are the
  only ones manageable from this feature — no other new badges.
- New Firebase path `adminBadges/{code}` — a JSON object like
  `{ "badge-developer": true, "badge-admin": true }` (only present keys are
  granted) — deliberately separate from `profiles/{code}` so
  `ProfilePublisher`'s re-publishes on the target's own account never
  overwrite it.
- New helper functions in `src/lib/moderationRealtime.ts` (same file as the
  existing ban/mute helpers, since this is the same "admin acts on another
  code" family): `grantAdminBadge(code, badgeId)` (sets
  `adminBadges/{code}/{badgeId}` to `true` via `update()`, merge — so
  granting one doesn't clear the other), `revokeAdminBadge(code, badgeId)`
  (removes that one key), `getAdminBadges(code)` (one-shot read, returns
  the object or `{}`).
- `fetchProfile(code)` (`src/lib/profileRealtime.ts`) is extended: after
  reading `profiles/{code}`, it also reads `adminBadges/{code}` and, if
  either key is present (preferring `badge-admin` over `badge-developer` if
  somehow both are granted, since ADMIN implies DEV), overrides the
  returned `badge` field before returning — every existing caller of
  `fetchProfile` (`FriendProfileModal`, `GroupMembersList`'s per-member
  fetch) gets the override for free, with no per-call-site changes needed.
- Admin tab UI: a friend-code input (matching the existing Actions tab's
  input styling), and for each of the two badges a pair of buttons ("Grant"
  / "Revoke") that call the new helpers directly (client-side Firebase
  writes, admin-gated by the fact only the admin account ever sees this
  tab — the write itself has no separate server-side check, matching how
  e.g. `setModerationState` is called directly from `ModerationPanel`
  today without an intermediate API route).

## Error Handling

- Friend-code input reuses the existing validation pattern already in
  `ModerationPanel` (normalize, reject if too short, toast on error) — no
  new validation logic needed.
- The gradient-name toggle's API route checks `isAdminEmail` server-side
  (like every other admin route) and returns 403 for anyone else.
- No new database migrations beyond the single `nameEffect` column; no new
  API routes beyond the one name-effect toggle (badge grant/revoke are
  direct Firebase writes, like moderation actions already are).

## Testing

No automated test framework exists in this project. Verification is
`npx tsc --noEmit` / `npx eslint .` plus a manual pass in the running dev
server, using the admin (`KyKy1`) account and one other local test account
(e.g. `Ohanaa`) already present in this dev environment:

- Toggle the animated name on/off, confirm it renders (and animates) in the
  admin's own Navbar/Sidebar and in another account's view of the admin's
  `FriendProfileModal`.
- Grant "DEV" to the other test account's friend code, confirm their badge
  shows as "DEV" in their `FriendProfileModal` and in `GroupMembersList` if
  they're in the shared "Game Hub" test server, even though their own
  `equippedBadge` is unrelated.
- Grant "ADMIN" too, confirm both keys coexist in Firebase and the display
  prefers ADMIN.
- Revoke both, confirm their own original badge reappears.
- Confirm a non-admin account cannot see the Admin tab at all (redirect
  still applies to the whole page) and that a direct call to the
  name-effect API route from a non-admin session is rejected.
- Clean up: revoke any test grants and turn the animated name back off
  (or leave it on, admin's choice) once verification is done.

## Out of Scope

- A color picker or multiple animated-name presets — one fixed built-in
  effect only.
- Extending admin-granted badge display to chat message headers or the
  Friends-list rows (locally-cached, same staleness already accepted for
  any badge change).
- Any additional badges beyond DEV and ADMIN.
- Any change to who counts as "the admin" — still the single `ADMIN_EMAIL`
  account; this feature doesn't introduce a multi-admin role system.
