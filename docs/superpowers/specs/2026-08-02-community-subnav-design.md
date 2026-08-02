# Friends Sub-Navigation Design Spec

Date: 2026-08-02

## Goal

Give the "Friends" icon in `ServerRail` (currently labeled "Community" —
renamed back to "Friends" as part of this change) its own Discord-style
second-column sub-navigation, exactly the way clicking a server icon already
swaps the main `Sidebar` for that server's `GroupChannelsSidebar`. Three
tabs: **Game Hub** (quick links to the app's existing Steam-related pages),
**Friends** (today's existing friends/groups list, unchanged), and
**Missions** (a new tab — placeholder only for now, real quests to be
designed later).

## Current State

- `ServerRail.tsx` renders a static icon (`Users`, `title="Community"`,
  linking to `/friends`) above the list of joined servers. `onCommunity`
  highlight is `pathname === "/friends"`.
- `Sidebar.tsx` renders the main app nav, including a `{ href: "/friends",
  label: "Community", icon: Users }` entry. It already returns `null` when
  `pathname.startsWith("/groups/")`, since inside a server the
  `ServerRail` + `GroupChannelsSidebar` pairing takes over as navigation —
  the main nav would be redundant clutter there.
- `/friends` (`src/app/(app)/friends/page.tsx`) renders a page header
  ("Community") plus `<FriendsHub>`, which already contains the full
  friends/groups list UI. `FriendsHub` itself is not changing.
- Steam-related content is currently spread across four separate existing
  pages: `/dashboard`, `/library`, `/achievements`, `/connect`. No page
  currently aggregates or links between them as a set.
- There is no missions/quests system anywhere in the codebase. In-app
  currency (`User.points` / `lifetimePointsEarned`) is currently earned only
  as a side effect of Steam sync (`awardPoints()` in `src/lib/gameSync.ts`),
  triggered by new achievement unlocks and new minutes played — there is no
  concept of a discrete, completable "task" today.
- No automated test framework exists in this project (confirmed: no `test`
  script in `package.json`). Verification is manual.

## 0. Naming: Community → Friends

Every user-facing occurrence of "Community" reverts to "Friends":
`ServerRail`'s icon `title`, `Sidebar`'s nav-item `label`, and the page
heading (`<h1>`) on the friends page. This is independent of the "Friends"
sub-tab introduced below — same pattern Discord itself uses (the icon and
one of its own sub-items share a name).

## 1. Routing and Layout Swap

Reuse the existing `/friends` route as the section root instead of adding a
new `/community` prefix — this avoids a redirect and keeps today's URL
working unchanged:

- `src/app/(app)/friends/layout.tsx` — new. Renders `<FriendsSidebar />`
  beside `{children}` in a flex row (mirroring how `GroupChannelsSidebar`
  sits beside chat content today).
- `src/app/(app)/friends/page.tsx` — unchanged content (page header text
  becomes "Friends" per section 0; still renders `<FriendsHub>` with the
  same props). This page IS the "Friends" tab — no separate route needed
  for it.
- `src/app/(app)/friends/game-hub/page.tsx` — new "Game Hub" tab content.
- `src/app/(app)/friends/missions/page.tsx` — new "Missions" tab,
  placeholder only.

`Sidebar.tsx`'s existing early-return gets one more condition:

```tsx
if (pathname.startsWith("/groups/") || pathname.startsWith("/friends")) return null;
```

`ServerRail.tsx` changes: `title` becomes `"Friends"` (href stays
`/friends`, unchanged), and `onCommunity` becomes
`pathname.startsWith("/friends")` (so it stays highlighted across all three
sub-tabs, not just the exact index route).

## 2. FriendsSidebar Component

New `src/components/FriendsSidebar.tsx`, visually consistent with the main
`Sidebar.tsx` (same `w-72`, `border-r`, `bg-surface/40 backdrop-blur-xl`,
same active-pill pattern using `motion.div layoutId` for the sliding
highlight) but with a fixed, non-dynamic list of exactly three links:

```tsx
const tabs = [
  { href: "/friends/game-hub", label: "Game Hub", icon: LayoutDashboard },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/friends/missions", label: "Missions", icon: Trophy },
];
```

Active state: `pathname === href` (this makes the "Friends" tab active only
on the exact `/friends` route, not on `/friends/game-hub` — an exact match
check is required precisely because `/friends` is a string-prefix of the
other two routes too).

**Note on styling divergence:** the shipped `FriendsSidebar` intentionally
does *not* match `w-72`/`border-r`/`bg-surface/40 backdrop-blur-xl` as stated
above — it uses `md:w-52` with no border and no background instead, since it
renders inside `<main>`'s own padded content area rather than as a direct
sibling of `<main>` the way `Sidebar`/`ServerRail` are, so the sticky/
full-viewport-height treatment described here doesn't apply. See
`docs/superpowers/plans/2026-08-02-friends-subnav.md`, Task 2, for the full
reasoning. This is a known, deliberate deviation from this spec, not a
defect.

## 3. Game Hub Tab

`src/app/(app)/friends/game-hub/page.tsx` — a page header ("Game Hub" /
short description) plus a responsive grid of four link-cards, one per
existing page, reusing the app's existing card/panel visual style (same
treatment as `StatCard`/dashboard cards):

| Card | Links to | Icon |
|---|---|---|
| Dashboard | `/dashboard` | `LayoutDashboard` |
| Library | `/library` | `Library` |
| Achievements | `/achievements` | `Trophy` |
| Connections | `/connect` | `Plug` |

Each card is just a styled `<Link>` — no data fetching, no duplicated logic
from the destination pages. Clicking a card navigates to that existing page
in the main content area; the `FriendsSidebar` and its tabs stay visible
only while the user is actually on a `/friends*` route (navigating away to
`/dashboard` naturally restores the normal `Sidebar`, per the routing rule
in section 1).

## 4. Friends Tab

No new file beyond the renamed heading text (section 0) — `/friends/page.tsx`
keeps fetching `friends`/`groups` and rendering `<FriendsHub>` exactly as
today. It is now nested under the new `friends/layout.tsx`, so it gains the
`FriendsSidebar` alongside it, but its own content and props are unchanged.

## 5. Missions Tab

`src/app/(app)/friends/missions/page.tsx` — placeholder only, per explicit
scope decision: build the tab/route now, design actual missions later as a
separate feature. Simple centered empty-state: an icon (`Trophy` or
`Sparkles`), a heading ("Missions"), and one line of body text ("Quests and
rewards are coming soon.") — reusing the existing `EmptyState` component if
its shape fits, otherwise plain markup matching its visual style. No schema
changes, no new API routes, no interaction with `User.points` in this pass.

## Error Handling

- No new user input, no new API routes, no new database fields — nothing in
  this feature can fail beyond normal Next.js routing/rendering. No new
  error handling is needed.

## Testing

Manual verification only (no automated test framework in this project):

- Click the Friends icon from any page → lands on `/friends`, main
  `Sidebar` disappears, `FriendsSidebar` appears with "Friends" highlighted,
  friends/groups list renders identically to before.
- Click "Game Hub" tab → four cards render; each navigates to its target
  page, and the main `Sidebar` correctly reappears once there (since those
  routes don't start with `/friends`).
- Click "Missions" tab → placeholder renders, no console errors.
- Confirm `ServerRail`'s icon tooltip now reads "Friends" and still
  highlights correctly while on any `/friends*` route, and that clicking a
  server icon still swaps to that server's own channel sidebar as before
  (no regression).
- Confirm the main `Sidebar`'s own nav entry now reads "Friends" instead of
  "Community" wherever the main `Sidebar` is visible.

## Out of Scope

- Any actual mission/quest definitions, reward logic, or claim UI — tracked
  as a future, separate feature once specific missions are decided.
- Any change to `FriendsHub`'s internal behavior.
- Any change to how points/currency are earned today (Steam-sync-based
  `awardPoints`).
- Consolidating Dashboard/Library/Achievements/Connections into a single
  merged page — Game Hub only links to them, it doesn't replace them.
