# Friends Sub-Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Friends icon in `ServerRail` its own second-column sub-navigation (Game Hub / Friends / Missions tabs), matching how a server's icon already swaps the main `Sidebar` for `GroupChannelsSidebar`.

**Architecture:** A new `src/app/(app)/friends/layout.tsx` wraps the existing `/friends` route tree in a flex row with a new `FriendsSidebar` tab component. `Sidebar.tsx` hides itself on any `/friends*` route (extending its existing `/groups/*` hide rule), and `ServerRail.tsx`'s icon is relabeled back to "Friends" and stays highlighted across all three sub-tabs. Two new pages (`game-hub`, `missions`) are added under `/friends/`; the existing `/friends/page.tsx` (today's `FriendsHub`) becomes the "Friends" tab as-is.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Framer Motion, lucide-react.

## Global Constraints

- No automated test framework exists in this project (no `test` script in `package.json`) — every task's verification step is a manual pass in the running dev server, not an automated test run.
- No new database migrations, no new API routes, no new Prisma fields — this feature is purely routing/UI.
- Reuse existing CSS utility classes only (`panel`, `panel-hover`, `icon-badge`, `glow-accent`, etc. from `src/app/globals.css`) — no new CSS classes needed.
- Every user-facing string that currently reads "Community" must read "Friends" instead (icon tooltip, main-nav label, page heading). The new "Friends" sub-tab name is intentionally the same word as the section name — this mirrors Discord's own pattern and is not a bug.
- `FriendsSidebar`'s active-tab check for the `/friends` (root) tab must be an **exact** pathname match (`pathname === "/friends"`), never a prefix match — `/friends` is a string-prefix of both `/friends/game-hub` and `/friends/missions`, so a prefix check would incorrectly highlight "Friends" on those other two tabs too.
- `ServerRail.tsx`'s own `onCommunity` highlight, by contrast, **is** a prefix check (`pathname.startsWith("/friends")`) — it must stay highlighted across all three sub-tabs, not just the root.

---

### Task 1: Rename "Community" back to "Friends" (labels only)

**Files:**
- Modify: `src/components/ServerRail.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/app/(app)/friends/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new (pure copy change, no new exports/props).

- [ ] **Step 1: Rename the ServerRail icon tooltip**

In `src/components/ServerRail.tsx`, find this `Link` (currently around line 74-82):

```tsx
        <Link
          href="/friends"
          title="Community"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
            onCommunity ? "rounded-2xl bg-accent text-black" : "bg-surface-2 text-foreground hover:rounded-2xl hover:bg-accent/20"
          }`}
        >
```

Change `title="Community"` to `title="Friends"`. Leave `href="/friends"` and everything else on this element unchanged for now (the `onCommunity` prefix-match change happens in Task 2).

- [ ] **Step 2: Rename the main Sidebar nav label**

In `src/components/Sidebar.tsx`, find this line in `baseLinks` (currently line 13):

```tsx
  { href: "/friends", label: "Community", icon: Users },
```

Change it to:

```tsx
  { href: "/friends", label: "Friends", icon: Users },
```

- [ ] **Step 3: Rename the Friends page heading**

In `src/app/(app)/friends/page.tsx`, find (currently line 26):

```tsx
        <h1 className="text-2xl font-bold text-foreground">Community</h1>
```

Change it to:

```tsx
        <h1 className="text-2xl font-bold text-foreground">Friends</h1>
```

The paragraph directly below it already reads "Friends, groups, and servers — add by code, chat, call, or join with an invite." — leave that line unchanged.

- [ ] **Step 4: Manual verification**

Start (or reuse) the dev server (`npm run dev`), then in the browser:

- Hover the people-icon at the top of the server rail (left of the joined-servers list) — the tooltip must read "Friends", not "Community".
- Confirm the same icon still navigates to `/friends` when clicked.
- On any page where the main left `Sidebar` is visible (e.g. `/dashboard`), confirm the nav item that used to read "Community" now reads "Friends".
- Visit `/friends` directly and confirm the page heading now reads "Friends" (the friends/groups list below it is unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/components/ServerRail.tsx src/components/Sidebar.tsx "src/app/(app)/friends/page.tsx"
git commit -m "Rename Community label back to Friends"
```

---

### Task 2: FriendsSidebar component + layout swap

**Files:**
- Create: `src/components/FriendsSidebar.tsx`
- Create: `src/app/(app)/friends/layout.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/ServerRail.tsx`

**Interfaces:**
- Consumes: nothing (no props — `FriendsSidebar` reads its own active state from `usePathname()`, exactly like `Sidebar.tsx` does).
- Produces: `FriendsSidebar` default export, a client component with no props, used only by `src/app/(app)/friends/layout.tsx`.

**Context:** Unlike `GroupChannelsSidebar` (which fills a fixed-height chat container via `sticky`/full-viewport-height styling because it's a direct sibling of `<main>`), this component lives *inside* `<main>`'s own padded content area — Next.js renders `friends/layout.tsx`'s output as the `{children}` of the app-wide `(app)/layout.tsx`'s `<main>`, so it must NOT use `sticky top-16 h-[calc(100vh-4rem)]` positioning (that only works for `ServerRail`/`Sidebar`, which sit outside `<main>`). Instead it's a plain flex column (rows of tabs stacked vertically on desktop, a horizontally-scrollable tab strip on narrow widths), scrolling naturally with the rest of the page.

- [ ] **Step 1: Create `src/components/FriendsSidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, Trophy } from "lucide-react";

const tabs = [
  { href: "/friends/game-hub", label: "Game Hub", icon: LayoutDashboard },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/friends/missions", label: "Missions", icon: Trophy },
];

export default function FriendsSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-52 md:flex-col md:overflow-visible md:pb-0">
      {tabs.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "text-accent-bright" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
            }`}
          >
            {active && (
              <motion.div
                layoutId="friends-sidebar-active-pill"
                className="glow-accent absolute inset-0 rounded-lg bg-accent/10 ring-1 ring-accent/30"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon size={18} className="relative z-10" />
            <span className="relative z-10">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

Note the exact-match `pathname === href` on the line `const active = pathname === href;` — this is required per the Global Constraints section (a prefix check would wrongly highlight "Friends" while on `/friends/game-hub`).

- [ ] **Step 2: Create `src/app/(app)/friends/layout.tsx`**

```tsx
import FriendsSidebar from "@/components/FriendsSidebar";

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <FriendsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
```

This wraps every page under `/friends/*` (including the existing `/friends` index page) automatically — no changes needed to `friends/page.tsx`'s own content for this step.

- [ ] **Step 3: Hide the main Sidebar on `/friends*` routes**

In `src/components/Sidebar.tsx`, find (currently line 49):

```tsx
  if (pathname.startsWith("/groups/")) return null;
```

Change it to:

```tsx
  if (pathname.startsWith("/groups/") || pathname.startsWith("/friends")) return null;
```

- [ ] **Step 4: Make the ServerRail icon stay highlighted across all three tabs**

In `src/components/ServerRail.tsx`, find (currently line 69):

```tsx
  const onCommunity = pathname === "/friends";
```

Change it to:

```tsx
  const onCommunity = pathname.startsWith("/friends");
```

- [ ] **Step 5: Manual verification**

With the dev server running:

- Visit `/friends`. Confirm the main left `Sidebar` (Dashboard/Library/... nav) is gone, and a new tab list appears in its place with three items: Game Hub, Friends, Missions. "Friends" should be highlighted (accent color + pill background).
- The friends/groups list content (`FriendsHub`) should render exactly as before, just now sitting to the right of the new tab list instead of the old Sidebar.
- Click "Game Hub" — the URL should change to `/friends/game-hub` and 404 (its page doesn't exist yet — that's expected, built in Task 3). Confirm the "Friends" tab is no longer highlighted once the URL changes (even on the 404, `FriendsSidebar` itself should still render with no tab highlighted, since neither `/friends/game-hub`'s exact string nor any other tab's href matches yet — this is fine, it'll resolve once Task 3 adds the real page).
- Navigate to `/dashboard`. Confirm the main `Sidebar` reappears normally, and its "Friends" nav item is present (from Task 1).
- Hover/click the Friends icon on the server rail from `/dashboard` — confirm it still navigates to `/friends` and highlights correctly.
- Click into any joined server (if one exists in this dev environment) and confirm the server's own channel sidebar still swaps in exactly as before — no regression from the `Sidebar.tsx` change.

- [ ] **Step 6: Commit**

```bash
git add src/components/FriendsSidebar.tsx "src/app/(app)/friends/layout.tsx" src/components/Sidebar.tsx src/components/ServerRail.tsx
git commit -m "Add FriendsSidebar tab list and swap main Sidebar on /friends routes"
```

---

### Task 3: Game Hub tab page

**Files:**
- Create: `src/app/(app)/friends/game-hub/page.tsx`

**Interfaces:**
- Consumes: nothing (static content, no data fetching, no props).
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create `src/app/(app)/friends/game-hub/page.tsx`**

```tsx
import Link from "next/link";
import { LayoutDashboard, Library, Trophy, Plug } from "lucide-react";

const cards = [
  {
    href: "/dashboard",
    label: "Dashboard",
    description: "Your stats and recently played games.",
    icon: LayoutDashboard,
  },
  {
    href: "/library",
    label: "Library",
    description: "Your full unified game collection.",
    icon: Library,
  },
  {
    href: "/achievements",
    label: "Achievements",
    description: "Track progress across every game.",
    icon: Trophy,
  },
  {
    href: "/connect",
    label: "Connections",
    description: "Manage linked platform accounts.",
    icon: Plug,
  },
];

export default function GameHubPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Game Hub</h1>
        <p className="text-sm text-muted">Quick links to everything about your Steam library.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map(({ href, label, description, icon: Icon }) => (
          <Link key={href} href={href} className="panel panel-hover flex items-center gap-4 p-4">
            <div className="icon-badge h-11 w-11 shrink-0">
              <Icon size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <p className="truncate text-xs text-muted">{description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

With the dev server running:

- Visit `/friends`, click the "Game Hub" tab. Confirm the URL is `/friends/game-hub`, the tab is highlighted, and four cards render: Dashboard, Library, Achievements, Connections — each with an icon, label, and one-line description.
- Click each of the four cards in turn and confirm it navigates to the corresponding real page (`/dashboard`, `/library`, `/achievements`, `/connect`), and that the main `Sidebar` correctly reappears on each of those pages (they don't start with `/friends`).
- Navigate back to `/friends/game-hub` via the browser back button or by clicking the Friends icon then the Game Hub tab again, and confirm it still renders correctly.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/friends/game-hub/page.tsx"
git commit -m "Add Game Hub tab with links to Dashboard, Library, Achievements, Connections"
```

---

### Task 4: Missions placeholder page

**Files:**
- Create: `src/app/(app)/friends/missions/page.tsx`

**Interfaces:**
- Consumes: `EmptyState` component (`src/components/EmptyState.tsx`), existing props: `icon: LucideIcon`, `title: string`, `children?: ReactNode`.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Create `src/app/(app)/friends/missions/page.tsx`**

```tsx
import { Trophy } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function MissionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Missions</h1>
        <p className="text-sm text-muted">Complete quests to earn points.</p>
      </div>

      <EmptyState icon={Trophy} title="Missions">
        Quests and rewards are coming soon.
      </EmptyState>
    </div>
  );
}
```

- [ ] **Step 2: Manual verification**

With the dev server running:

- Visit `/friends`, click the "Missions" tab. Confirm the URL is `/friends/missions`, the tab is highlighted, and the placeholder renders: heading "Missions", subtext "Complete quests to earn points.", and the dashed empty-state box with a trophy icon and "Quests and rewards are coming soon."
- Open the browser console and confirm there are no errors on this page.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/friends/missions/page.tsx"
git commit -m "Add Missions tab placeholder"
```

---

### Task 5: End-to-end verification and cleanup

**Files:** none (verification only).

**Interfaces:** none.

- [ ] **Step 1: Full click-through in the running dev server**

- From any page with the main `Sidebar` visible, click the Friends icon on the server rail. Confirm: main `Sidebar` disappears, `FriendsSidebar` appears with "Friends" highlighted, the existing friends/groups list renders unchanged.
- Click "Game Hub". Confirm the tab highlights and all four cards work.
- Click "Missions". Confirm the placeholder renders cleanly.
- Click back to "Friends". Confirm the tab highlight moves correctly and the friends/groups list still works (add/search/whatever was already there).
- From `/friends/game-hub` or `/friends/missions`, click a normal main-nav destination via one of the Game Hub cards (e.g. Dashboard). Confirm the main `Sidebar` reappears and reads "Friends" (not "Community") in its nav list.
- Join or open an existing server from the server rail. Confirm the server's own channel sidebar still swaps in exactly as before (no regression introduced by the `Sidebar.tsx` hide-condition change).
- Resize the browser to a narrow width (or use the browser's responsive/mobile emulation) and confirm the `FriendsSidebar` tab list becomes a horizontally-scrollable strip instead of overflowing or breaking layout.

- [ ] **Step 2: Check for regressions**

Run `npx tsc --noEmit` and `npx eslint .` and confirm both are clean (no new errors introduced by this feature).

- [ ] **Step 3: Final commit (if any cleanup was needed)**

If Step 1 or Step 2 surfaced any fixes, commit them:

```bash
git add -A
git commit -m "Fix issues found in end-to-end verification of Friends sub-navigation"
```

If nothing needed fixing, no commit is needed for this task.
