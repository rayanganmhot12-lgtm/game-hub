# Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin account (the single `ADMIN_EMAIL` user) an "Admin" tab on the existing `/moderation` page with an animated gradient name toggle for themselves, and the ability to grant/revoke a DEV badge and a new ADMIN badge to any friend by code — visible to everyone immediately, without touching that person's own local database.

**Architecture:** A new nullable `User.nameEffect` column plus a new admin-gated API route drive the self-only gradient name, published through the existing `ProfilePublisher`/`profiles/{code}` Firebase snapshot. Badge grants use a brand-new, separate Firebase path (`adminBadges/{code}`) so they can never be clobbered by the target's own profile republishes, and `fetchProfile()` is extended to overlay a granted badge onto whatever it returns — every existing caller (`FriendProfileModal`, `GroupMembersList`) picks up the override automatically.

**Tech Stack:** Next.js 16 App Router, Prisma 7/SQLite, Firebase Realtime Database, TypeScript, Tailwind CSS v4.

## Global Constraints

- Frontend + one schema migration + one new API route are all in scope for
  this plan (unlike a purely visual redesign) — but no other new API routes
  beyond the single name-effect toggle; badge grant/revoke are direct
  client-side Firebase writes, matching how existing moderation actions
  (`setModerationState`, `sendWarning`) already work.
- `nameEffect` column values: the string `"gradient-cycle"` or `null` —
  no other values, no color-picker UI.
- New Firebase path for badge grants: `adminBadges/{code}`, an object like
  `{ "badge-developer": true, "badge-admin": true }` — never written into
  `profiles/{code}`.
- Exactly two grantable badges: the existing `"badge-developer"` id and a
  new `"badge-admin"` id. No other new badges.
- If both `badge-developer` and `badge-admin` are granted to the same
  person, display prefers `badge-admin`.
- No automated test framework exists in this project — verification per
  task is `npx tsc --noEmit` and `npx eslint .`, plus a manual pass in the
  running dev server using the admin account (`KyKy1`, matches
  `ADMIN_EMAIL`) and one other already-present local test account
  (`Ohanaa`) as the grant target. Revoke any test grants and leave the
  animated name in whatever state the admin wants once verification is
  done.

---

### Task 1: Animated gradient name (schema, publish, display)

**Files:**
- Modify: `prisma/schema.prisma` (`User` model, currently lines 18-68)
- Modify: `src/lib/auth.ts` (`getCurrentUser`'s `select`, currently lines 9-28)
- Modify: `src/app/globals.css` (badge/banner cosmetics section, currently
  around lines 282-342)
- Create: `src/app/api/admin/name-effect/route.ts`
- Modify: `src/lib/profileRealtime.ts` (`PublicProfile` interface, currently
  lines 12-32)
- Modify: `src/components/ProfilePublisher.tsx`
- Modify: `src/app/(app)/layout.tsx` (currently lines 49-89)
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/UserPanel.tsx`
- Modify: `src/components/FriendProfileModal.tsx` (name heading, currently
  line 210)
- Create: `src/components/AdminPanel.tsx`
- Modify: `src/app/(app)/moderation/page.tsx`

**Interfaces:**
- Consumes: nothing from other tasks (first task).
- Produces: `AdminPanel` component with props
  `{ initialNameEffect: string | null }` — Task 2 extends this same file
  and its props stay the same. `PublicProfile.nameEffect?: string | null`
  — Task 2 doesn't touch this field.

- [ ] **Step 1: Add the `nameEffect` column**

In `prisma/schema.prisma`, inside the `User` model, add this line right
after `equippedBanner       String?` (currently line 55):

```prisma
  // Self-only cosmetic, admin account only in practice: an animated
  // two-color gradient effect for the display name. "gradient-cycle" or
  // unset — no other values, no color picker.
  nameEffect           String?
```

- [ ] **Step 2: Generate and apply the migration**

Run: `npx prisma migrate dev --name add_name_effect`
Expected: a new folder appears under `prisma/migrations/` containing an
`ALTER TABLE "User" ADD COLUMN "nameEffect" TEXT;` statement, applied to
`dev.db` without errors.

- [ ] **Step 3: Expose it from `getCurrentUser()`**

In `src/lib/auth.ts`, inside the `select` object (currently ending with
`pinnedCosmeticId: true,` at line 27), add:

```ts
      pinnedCosmeticId: true,
      nameEffect: true,
```

- [ ] **Step 4: Add the gradient CSS class**

In `src/app/globals.css`, immediately after the `.badge-hellokitty` block
(currently lines 294-297), add:

```css
.name-gradient-cycle {
  background: linear-gradient(90deg, var(--accent-bright), #a855f7, var(--accent-bright));
  background-size: 200% auto;
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: name-gradient-shift 3s linear infinite;
}
@keyframes name-gradient-shift {
  to {
    background-position: -200% center;
  }
}
```

Then add `.name-gradient-cycle` to the existing
`@media (prefers-reduced-motion: reduce)` selector list (currently lines
335-342), so the final block reads:

```css
@media (prefers-reduced-motion: reduce) {
  .frame-gold,
  .frame-neon-pulse,
  .banner-shimmer::after,
  .banner-aurora::after,
  .name-gradient-cycle {
    animation: none;
  }
}
```

- [ ] **Step 5: Add the admin-gated toggle API route**

Create `src/app/api/admin/name-effect/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const enabled = body.enabled === true;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { nameEffect: enabled ? "gradient-cycle" : null },
    select: { nameEffect: true },
  });

  return NextResponse.json({ nameEffect: updated.nameEffect });
}
```

- [ ] **Step 6: Add `nameEffect` to the published profile shape**

In `src/lib/profileRealtime.ts`, add this field to the `PublicProfile`
interface (currently lines 12-32), right after the existing `badge` field:

```ts
  badge?: string | null;
  // "gradient-cycle" or unset — see the .name-gradient-cycle CSS class.
  nameEffect?: string | null;
```

- [ ] **Step 7: Publish it from `ProfilePublisher`**

In `src/components/ProfilePublisher.tsx`, add `nameEffect` to the props
type, destructure it, include it in the `publishMyProfile` call, and add it
to the effect's dependency array. The full updated file:

```tsx
"use client";

import { useEffect } from "react";
import { publishMyProfile } from "@/lib/profileRealtime";

// Keeps this installation's public profile snapshot in Firebase fresh —
// mounted globally so any change made anywhere (Profile page, Store equips)
// gets picked up the next time any page renders, not just /profile visits.
export default function ProfilePublisher({
  myCode,
  displayName,
  avatarDataUrl,
  bannerDataUrl,
  bio,
  pronouns,
  profileNote,
  badge,
  frame,
  banner,
  accentColor,
  pinnedCosmeticId,
  nameEffect,
}: {
  myCode: string;
  displayName: string;
  avatarDataUrl: string | null;
  bannerDataUrl: string | null;
  bio: string | null;
  pronouns: string | null;
  profileNote: string | null;
  badge: string | null;
  frame: string | null;
  banner: string | null;
  accentColor: string | null;
  pinnedCosmeticId: string | null;
  nameEffect: string | null;
}) {
  useEffect(() => {
    publishMyProfile(myCode, {
      displayName,
      avatarDataUrl,
      bannerDataUrl,
      bio,
      pronouns,
      profileNote,
      badge,
      frame,
      banner,
      accentColor,
      pinnedCosmeticId,
      nameEffect,
    });
  }, [
    myCode,
    displayName,
    avatarDataUrl,
    bannerDataUrl,
    bio,
    pronouns,
    profileNote,
    badge,
    frame,
    banner,
    accentColor,
    pinnedCosmeticId,
    nameEffect,
  ]);

  return null;
}
```

- [ ] **Step 8: Pass it through the app layout**

In `src/app/(app)/layout.tsx`, add `nameEffect={user.nameEffect}` to the
existing `<ProfilePublisher ... />` call (currently lines 49-62), and add
`nameEffect={user.nameEffect}` to the existing `<Sidebar ... />` call
(currently lines 82-89).

- [ ] **Step 9: Thread it into `Sidebar` and `UserPanel`**

In `src/components/Sidebar.tsx`, add `nameEffect: string | null;` to the
props destructure and type (alongside `equippedBadge`), and pass
`nameEffect={nameEffect}` to the existing `<UserPanel ... />` call
(currently lines 72-78).

In `src/components/UserPanel.tsx`, add `nameEffect` to the props
destructure and type, then change the name line (currently line 43) from:

```tsx
          <p className="truncate text-base font-medium text-foreground">{displayName}</p>
```

to:

```tsx
          <p
            className={`truncate text-base font-medium ${
              nameEffect === "gradient-cycle" ? "name-gradient-cycle" : "text-foreground"
            }`}
          >
            {displayName}
          </p>
```

- [ ] **Step 10: Show it in `FriendProfileModal` too**

In `src/components/FriendProfileModal.tsx`, change the name heading
(currently line 210) from:

```tsx
              <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
```

to:

```tsx
              <h2
                className={`text-lg font-bold ${
                  profile?.nameEffect === "gradient-cycle" ? "name-gradient-cycle" : "text-foreground"
                }`}
              >
                {displayName}
              </h2>
```

- [ ] **Step 11: Create `AdminPanel` with the toggle**

Create `src/components/AdminPanel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function AdminPanel({
  initialNameEffect,
}: {
  initialNameEffect: string | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [nameEffect, setNameEffect] = useState(initialNameEffect);
  const [saving, setSaving] = useState(false);

  async function toggleNameEffect() {
    const enabled = !nameEffect;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/name-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Couldn't update your name effect.");
      const { nameEffect: updated } = await res.json();
      setNameEffect(updated);
      showToast(enabled ? "Animated name enabled." : "Animated name disabled.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update your name effect.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles size={16} className="text-accent-bright" />
        Animated Name
      </h2>
      <p className="mb-3 text-xs text-muted">
        Shows your display name with a moving two-color gradient, everywhere your name appears.
      </p>
      <button onClick={toggleNameEffect} disabled={saving} className="btn-primary">
        {nameEffect ? "Turn Off" : "Turn On"}
      </button>
    </div>
  );
}
```

- [ ] **Step 12: Render it on the Moderation page (temporary placement)**

In `src/app/(app)/moderation/page.tsx`, import `AdminPanel` and render it
directly below the existing `<ModerationPanel ... />` call, passing
`initialNameEffect={user.nameEffect}`. This is a temporary, un-tabbed
placement — Task 3 wraps both panels in a proper tab switcher. The full
updated file:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import ModerationPanel from "@/components/ModerationPanel";
import AdminPanel from "@/components/AdminPanel";

export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  const [actions, friends] = await Promise.all([
    prisma.moderationAction.findMany({
      where: { adminUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.friend.findMany({ where: { userId: user.id }, orderBy: { friendDisplayName: "asc" } }),
  ]);

  const myDisplayName = getDisplayName(user);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Moderation</h1>
        <p className="text-sm text-muted">Warn, mute, timeout, or ban a user by their friend code.</p>
      </div>
      <ModerationPanel myDisplayName={myDisplayName} initialActions={actions} friends={friends} />
      <AdminPanel initialNameEffect={user.nameEffect} />
    </div>
  );
}
```

- [ ] **Step 13: Run the verification commands**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 14: Manual check in the browser**

As the `KyKy1` admin account, on `/moderation`: click "Turn On" under
Animated Name, confirm the toggle button now reads "Turn Off" and your
name in the Sidebar's bottom-left `UserPanel` renders with a moving
two-color gradient instead of plain text. Open your own
`FriendProfileModal` from another account's Friends list (or view your own
profile card if reachable) and confirm the gradient shows there too. Click
"Turn Off" and confirm both places revert to plain text.

- [ ] **Step 15: Commit**

```bash
git add prisma/schema.prisma prisma/migrations src/lib/auth.ts src/app/globals.css src/app/api/admin/name-effect/route.ts src/lib/profileRealtime.ts src/components/ProfilePublisher.tsx "src/app/(app)/layout.tsx" src/components/Sidebar.tsx src/components/UserPanel.tsx src/components/FriendProfileModal.tsx src/components/AdminPanel.tsx "src/app/(app)/moderation/page.tsx"
git commit -m "Add animated gradient name toggle for the admin account"
```

---

### Task 2: DEV / ADMIN badge grant and revoke

**Files:**
- Modify: `src/components/CosmeticFrame.tsx` (`BADGE_LABELS`, currently
  lines 14-21)
- Modify: `src/lib/cosmetics.ts` (`COSMETIC_CATALOG`, currently lines 19-70)
- Modify: `src/app/globals.css` (badge section, currently lines 282-297)
- Modify: `src/lib/moderationRealtime.ts`
- Modify: `src/lib/profileRealtime.ts` (`fetchProfile`, currently lines
  54-59)
- Modify: `src/components/AdminPanel.tsx` (created in Task 1)

**Interfaces:**
- Consumes: `AdminPanel` component from Task 1 (props
  `{ initialNameEffect: string | null }`, kept unchanged) — this task adds
  new internal state and JSX to that same file, not new props.
- Produces: `grantAdminBadge(code: string, badgeId: string): Promise<void>`,
  `revokeAdminBadge(code: string, badgeId: string): Promise<void>`, and
  `getAdminBadges(code: string): Promise<Record<string, boolean>>` in
  `src/lib/moderationRealtime.ts` — not consumed by any later task in this
  plan, but this is the reusable admin-badge API for any future caller.

- [ ] **Step 1: Add the ADMIN badge definition**

In `src/components/CosmeticFrame.tsx`, inside `BADGE_LABELS` (currently
lines 14-21), add this entry right after `"badge-developer"`:

```ts
  "badge-admin": { label: "ADMIN", className: "badge-admin" },
```

- [ ] **Step 2: Add it to the cosmetics catalog**

In `src/lib/cosmetics.ts`, inside `COSMETIC_CATALOG` (currently lines
19-70), add this entry right after the `"badge-developer"` entry:

```ts
  {
    id: "badge-admin",
    type: "badge",
    name: '"Admin" Badge',
    description: "Granted by the developer account only.",
    cost: 0,
    adminOnly: true,
  },
```

- [ ] **Step 3: Add its CSS**

In `src/app/globals.css`, immediately after the `.badge-developer` block
(currently lines 290-293), add:

```css
.badge-admin {
  background: linear-gradient(135deg, #fb7185, #e11d48);
  color: #fff1f2;
}
```

- [ ] **Step 4: Add the grant/revoke/read Firebase helpers**

In `src/lib/moderationRealtime.ts`, add these three functions right after
`resetModerationState` (currently ending at line 60):

```ts
export type AdminBadgeGrants = Record<string, boolean>;

// Admin-granted badges live at their own path, never inside profiles/{code}
// — ProfilePublisher re-publishes that node's `badge` field from the
// target's own equippedBadge every time any of their own profile fields
// change, which would silently clobber an override stored there. This
// path is never touched by the target's own client.
export function grantAdminBadge(code: string, badgeId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return update(ref(db, `adminBadges/${code}`), { [badgeId]: true });
}

export function revokeAdminBadge(code: string, badgeId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Chat isn't set up yet."));
  return remove(ref(db, `adminBadges/${code}/${badgeId}`));
}

export async function getAdminBadges(code: string): Promise<AdminBadgeGrants> {
  const db = getFirebaseDb();
  if (!db) return {};
  const snap = await get(ref(db, `adminBadges/${code}`));
  return snap.val() ?? {};
}
```

No new imports are needed — `ref`, `update`, `get`, and `remove` are all
already imported at the top of this file.

- [ ] **Step 5: Overlay the admin-granted badge in `fetchProfile`**

In `src/lib/profileRealtime.ts`, replace the current `fetchProfile`
function (currently lines 54-59):

```ts
export async function fetchProfile(code: string): Promise<PublicProfile | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snapshot = await get(ref(db, `profiles/${code}`));
  return snapshot.val();
}
```

with:

```ts
export async function fetchProfile(code: string): Promise<PublicProfile | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const [profileSnap, adminBadgesSnap] = await Promise.all([
    get(ref(db, `profiles/${code}`)),
    get(ref(db, `adminBadges/${code}`)),
  ]);
  const profile: PublicProfile | null = profileSnap.val();
  if (!profile) return null;
  const adminBadges: Record<string, boolean> = adminBadgesSnap.val() ?? {};
  if (adminBadges["badge-admin"]) return { ...profile, badge: "badge-admin" };
  if (adminBadges["badge-developer"]) return { ...profile, badge: "badge-developer" };
  return profile;
}
```

- [ ] **Step 6: Add the grant/revoke UI to `AdminPanel`**

Replace the full contents of `src/components/AdminPanel.tsx` (created in
Task 1) with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { normalizeFriendCode } from "@/lib/friendCode";
import { grantAdminBadge, revokeAdminBadge } from "@/lib/moderationRealtime";

type GrantableBadge = "badge-developer" | "badge-admin";

export default function AdminPanel({
  initialNameEffect,
}: {
  initialNameEffect: string | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [nameEffect, setNameEffect] = useState(initialNameEffect);
  const [saving, setSaving] = useState(false);
  const [badgeCodeInput, setBadgeCodeInput] = useState("");
  const [badgeBusy, setBadgeBusy] = useState(false);

  async function toggleNameEffect() {
    const enabled = !nameEffect;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/name-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Couldn't update your name effect.");
      const { nameEffect: updated } = await res.json();
      setNameEffect(updated);
      showToast(enabled ? "Animated name enabled." : "Animated name disabled.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update your name effect.", "error");
    } finally {
      setSaving(false);
    }
  }

  function getBadgeTargetCode(): string | null {
    const code = normalizeFriendCode(badgeCodeInput);
    if (code.length < 6) {
      showToast("Enter a valid friend code.", "error");
      return null;
    }
    return code;
  }

  function badgeLabel(badgeId: GrantableBadge): string {
    return badgeId === "badge-admin" ? "ADMIN" : "DEV";
  }

  async function handleGrantBadge(badgeId: GrantableBadge) {
    const code = getBadgeTargetCode();
    if (!code) return;
    setBadgeBusy(true);
    try {
      await grantAdminBadge(code, badgeId);
      showToast(`Granted ${badgeLabel(badgeId)} badge.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't grant badge.", "error");
    } finally {
      setBadgeBusy(false);
    }
  }

  async function handleRevokeBadge(badgeId: GrantableBadge) {
    const code = getBadgeTargetCode();
    if (!code) return;
    setBadgeBusy(true);
    try {
      await revokeAdminBadge(code, badgeId);
      showToast(`Revoked ${badgeLabel(badgeId)} badge.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't revoke badge.", "error");
    } finally {
      setBadgeBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <Sparkles size={16} className="text-accent-bright" />
          Animated Name
        </h2>
        <p className="mb-3 text-xs text-muted">
          Shows your display name with a moving two-color gradient, everywhere your name appears.
        </p>
        <button onClick={toggleNameEffect} disabled={saving} className="btn-primary">
          {nameEffect ? "Turn Off" : "Turn On"}
        </button>
      </div>

      <div className="panel p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck size={16} className="text-accent-bright" />
          Grant DEV / ADMIN Badge
        </h2>
        <p className="mb-3 text-xs text-muted">
          Shows instantly on their profile and member lists — doesn&apos;t touch their own account data.
        </p>
        <input
          value={badgeCodeInput}
          onChange={(e) => setBadgeCodeInput(e.target.value)}
          placeholder="XXXX-XXXX (friend code)"
          className="input-field mb-3 w-full"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => handleGrantBadge("badge-developer")} disabled={badgeBusy} className="btn-primary flex-1">
            Grant DEV
          </button>
          <button onClick={() => handleRevokeBadge("badge-developer")} disabled={badgeBusy} className="btn-ghost flex-1">
            Revoke DEV
          </button>
          <button onClick={() => handleGrantBadge("badge-admin")} disabled={badgeBusy} className="btn-primary flex-1">
            Grant ADMIN
          </button>
          <button onClick={() => handleRevokeBadge("badge-admin")} disabled={badgeBusy} className="btn-ghost flex-1">
            Revoke ADMIN
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Run the verification commands**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 8: Manual check in the browser**

As `KyKy1` on `/moderation`, enter the `Ohanaa` test account's friend code
in the Grant DEV/ADMIN section and click "Grant DEV". Open that account's
`FriendProfileModal` (from a friends list or, if convenient, log in as
`Ohanaa` in another browser/session) and confirm their badge now shows
"DEV" regardless of whatever badge they had equipped before. Click "Grant
ADMIN" too (without revoking DEV) and confirm the badge display switches
to "ADMIN". Click "Revoke ADMIN" and confirm it falls back to showing
"DEV". Click "Revoke DEV" and confirm their own original equipped badge
(or no badge) reappears.

- [ ] **Step 9: Commit**

```bash
git add src/components/CosmeticFrame.tsx src/lib/cosmetics.ts src/app/globals.css src/lib/moderationRealtime.ts src/lib/profileRealtime.ts src/components/AdminPanel.tsx
git commit -m "Add DEV/ADMIN badge grant and revoke, visible via Firebase overlay"
```

---

### Task 3: Wrap Actions and Admin content in tabs

**Files:**
- Create: `src/components/ModerationTabs.tsx`
- Modify: `src/app/(app)/moderation/page.tsx`

**Interfaces:**
- Consumes: `ModerationPanel` (existing, props
  `{ myDisplayName: string; initialActions: ModerationActionLog[]; friends: Friend[] }`)
  and `AdminPanel` (from Tasks 1-2, props `{ initialNameEffect: string | null }`)
  — both unchanged.
- Produces: `ModerationTabs` component, props
  `{ myDisplayName: string; initialActions: ModerationActionLog[]; friends: Friend[]; initialNameEffect: string | null }`
  — not consumed by any later task in this plan.

- [ ] **Step 1: Create the tab switcher**

Create `src/components/ModerationTabs.tsx`:

```tsx
"use client";

import { useState } from "react";
import ModerationPanel from "@/components/ModerationPanel";
import AdminPanel from "@/components/AdminPanel";

interface ModerationActionLog {
  id: string;
  targetCode: string;
  targetDisplayName: string;
  action: string;
  reason: string | null;
  createdAt: string | Date;
}

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
}

type Tab = "actions" | "admin";

export default function ModerationTabs({
  myDisplayName,
  initialActions,
  friends,
  initialNameEffect,
}: {
  myDisplayName: string;
  initialActions: ModerationActionLog[];
  friends: Friend[];
  initialNameEffect: string | null;
}) {
  const [tab, setTab] = useState<Tab>("actions");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["actions", "Actions"],
            ["admin", "Admin"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === value ? "border-b-2 border-accent-bright text-accent-bright" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "actions" ? (
        <ModerationPanel myDisplayName={myDisplayName} initialActions={initialActions} friends={friends} />
      ) : (
        <AdminPanel initialNameEffect={initialNameEffect} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Moderation page**

Replace the full contents of `src/app/(app)/moderation/page.tsx` with:

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import ModerationTabs from "@/components/ModerationTabs";

export default async function ModerationPage() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  const [actions, friends] = await Promise.all([
    prisma.moderationAction.findMany({
      where: { adminUserId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.friend.findMany({ where: { userId: user.id }, orderBy: { friendDisplayName: "asc" } }),
  ]);

  const myDisplayName = getDisplayName(user);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Moderation</h1>
        <p className="text-sm text-muted">Warn, mute, timeout, or ban a user by their friend code.</p>
      </div>
      <ModerationTabs
        myDisplayName={myDisplayName}
        initialActions={actions}
        friends={friends}
        initialNameEffect={user.nameEffect}
      />
    </div>
  );
}
```

- [ ] **Step 3: Run the verification commands**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 4: Manual check in the browser**

On `/moderation`, confirm two tabs appear ("Actions", "Admin"), "Actions" is
selected by default and shows exactly the same warn/mute/timeout/ban/
announce content as before, and clicking "Admin" shows the Animated Name
and Grant/Revoke Badge sections from Tasks 1-2 (and that they still work).
Confirm switching back to "Actions" doesn't lose anything (e.g. a
half-typed target code is fine to lose — that's expected tab-switch
behavior, not a bug).

- [ ] **Step 5: Commit**

```bash
git add src/components/ModerationTabs.tsx "src/app/(app)/moderation/page.tsx"
git commit -m "Wrap Moderation page's Actions and Admin content in tabs"
```

---

### Task 4: End-to-end verification and cleanup

**Files:** none (verification-only task, no source changes expected).

**Interfaces:**
- Consumes: the combined output of Tasks 1-3, all in place.
- Produces: nothing — this is the plan's final task.

- [ ] **Step 1: Full-feature manual walkthrough**

As `KyKy1` (admin), on `/moderation`'s Admin tab:
- Confirm a non-admin account cannot reach `/moderation` at all (still
  redirects to `/dashboard`).
- Turn the animated name on, confirm it shows in the Sidebar `UserPanel`
  and in another account's view of your `FriendProfileModal`; turn it back
  off (or leave it on, whichever the admin prefers going forward) and
  confirm it reverts everywhere it was showing.
- Grant DEV to `Ohanaa`, confirm it shows in their `FriendProfileModal` and
  in `GroupMembersList` if they're a member of the shared "Game Hub" test
  server; grant ADMIN too and confirm ADMIN takes display priority; revoke
  both and confirm their own original badge (or lack of one) returns.
- From a non-admin session (or via a direct `curl`/fetch without the admin
  session cookie), confirm `POST /api/admin/name-effect` returns 403.

- [ ] **Step 2: Run the full verification suite one more time**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 3: Clean up test grants**

Confirm no leftover admin-badge grants remain on the `Ohanaa` test account
(both DEV and ADMIN revoked, unless deliberately left for further testing
by the user) and that Firebase's `adminBadges/{Ohanaa's code}` node is
empty.

- [ ] **Step 4: Final commit (only if Step 1 surfaced fixes)**

If the walkthrough in Step 1 required any small fixes, commit them now:

```bash
git add -A
git commit -m "Fix issues found in full admin panel walkthrough"
```

If nothing needed fixing, skip this step — Tasks 1-3's commits already
cover the complete change.
