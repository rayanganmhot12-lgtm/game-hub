# Community Sub-Navigation Design Spec

Date: 2026-08-02

## Goal

Give the "Community" icon in `ServerRail` its own Discord-style second-column
sub-navigation, exactly the way clicking a server icon already swaps the main
`Sidebar` for that server's `GroupChannelsSidebar`. Three tabs: **Game Hub**
(quick links to the app's existing Steam-related pages), **Friends** (today's
existing friends/groups list, unchanged), and **Missions** (a new tab —
placeholder only for now, real quests to be designed later).

## Current State

- `ServerRail.tsx` renders a static "Community" icon (`Users`, linking to
  `/friends`) above the list of joined servers. `onCommunity` highlight is
  `pathname === "/friends"`.
- `Sidebar.tsx` renders the main app nav (Dashboard, Library, Achievements,
  Community, Connections, Playlist, Store, Theme Editor, Recap, and
  Moderation for admins). It already returns `null` when
  `pathname.startsWith("/groups/")`, since inside a server the
  `ServerRail` + `GroupChannelsSidebar` pairing takes over as navigation —
  the main nav would be redundant clutter there.
- `/friends` (`src/app/(app)/friends/page.tsx`) renders a page header plus
  `<FriendsHub>`, which already contains the full friends/groups list UI.
  This component is not changing.
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

## 1. Routing and Layout Swap

New route group `src/app/(app)/community/` with a shared layout:

- `src/app/(app)/community/layout.tsx` — renders `<CommunitySidebar />`
  beside `{children}` in a flex row (mirroring how `GroupChannelsSidebar`
  sits beside chat content today).
- `src/app/(app)/community/game-hub/page.tsx` — new "Game Hub" tab content.
- `src/app/(app)/community/friends/page.tsx` — moves today's `/friends`
  page content here verbatim (same header + `<FriendsHub>`, same props).
- `src/app/(app)/community/missions/page.tsx` — new "Missions" tab,
  placeholder only.
- `src/app/(app)/friends/page.tsx` — replaced with a server-side
  `redirect("/community/friends")`, so nothing that already links to
  `/friends` breaks.

`Sidebar.tsx`'s existing early-return gets one more condition:

```tsx
if (pathname.startsWith("/groups/") || pathname.startsWith("/community")) return null;
```

`ServerRail.tsx` changes: the Community link's `href` becomes
`/community/friends` (so it lands on a real default tab, not a bare
`/community` with nothing to render), and `onCommunity` becomes
`pathname.startsWith("/community")`.

## 2. CommunitySidebar Component

New `src/components/CommunitySidebar.tsx`, visually consistent with the main
`Sidebar.tsx` (same `w-72`, `border-r`, `bg-surface/40 backdrop-blur-xl`,
same active-pill pattern using `motion.div layoutId` for the sliding
highlight) but with a fixed, non-dynamic list of exactly three links:

```tsx
const tabs = [
  { href: "/community/game-hub", label: "Game Hub", icon: LayoutDashboard },
  { href: "/community/friends", label: "Friends", icon: Users },
  { href: "/community/missions", label: "Missions", icon: Trophy },
];
```

Active state: `pathname === href`. No props needed beyond what `usePathname`
already gives it — no server data, no per-user variation.

## 3. Game Hub Tab

`src/app/(app)/community/game-hub/page.tsx` — a page header ("Game Hub" /
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
in the main content area; the `CommunitySidebar` and its "Game Hub" tab stay
highlighted only while the user is actually on `/community/game-hub` itself
(navigating away to `/dashboard` naturally restores the normal `Sidebar`,
per the routing rule in section 1).

## 4. Friends Tab

`src/app/(app)/community/friends/page.tsx` — byte-for-byte the same content
that `src/app/(app)/friends/page.tsx` has today (fetch `friends`/`groups`,
render `<FriendsHub>` with the same props). Purely a file move plus the
redirect described in section 1. No behavior change.

## 5. Missions Tab

`src/app/(app)/community/missions/page.tsx` — placeholder only, per explicit
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

- Click the Community icon from any page → lands on `/community/friends`,
  main `Sidebar` disappears, `CommunitySidebar` appears with "Friends"
  highlighted, friends/groups list renders identically to before.
- Click "Game Hub" tab → four cards render; each navigates to its target
  page, and the main `Sidebar` correctly reappears once there (since those
  routes don't start with `/community`).
- Click "Missions" tab → placeholder renders, no console errors.
- Visit the old `/friends` URL directly → redirects to `/community/friends`.
- Confirm `ServerRail`'s Community icon still highlights correctly while on
  any `/community/*` route, and that clicking a server icon still swaps to
  that server's own channel sidebar as before (no regression).

## Out of Scope

- Any actual mission/quest definitions, reward logic, or claim UI — tracked
  as a future, separate feature once specific missions are decided.
- Any change to `FriendsHub`'s internal behavior.
- Any change to how points/currency are earned today (Steam-sync-based
  `awardPoints`).
- Consolidating Dashboard/Library/Achievements/Connections into a single
  merged page — Game Hub only links to them, it doesn't replace them.
