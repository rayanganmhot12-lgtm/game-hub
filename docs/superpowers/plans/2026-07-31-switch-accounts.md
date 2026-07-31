# Switch Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user save up to 5 logged-in Game Hub accounts on one device and switch between them instantly (no password), matching Discord's Switch Accounts popup.

**Architecture:** Extend the single existing `iron-session` cookie (`gamehub_session`) with a `savedAccounts` list instead of building any server-side session store. Login/switch/logout routes move entries between "active" (`session.userId`) and "saved" (`session.savedAccounts`); a new self-contained `SwitchAccountsMenu` component renders the list and an inline "Add Another Account" form inside `FriendProfileModal`.

**Tech Stack:** Next.js 16 App Router, iron-session, Prisma 7 (SQLite via better-sqlite3), React (client components), Tailwind, lucide-react icons.

## Global Constraints

- Max 5 saved accounts per device (enforced when adding, not when switching).
- No new database table — everything lives in the session cookie.
- Normal (non-"add-account") login must keep clearing `savedAccounts`, so a fresh logout→login cycle never carries over a stale switcher list.
- Verification in this repo has no test runner configured (`npm run lint` = ESLint only, no jest/vitest). Every task's "verify" steps use `npx tsc --noEmit`, `npx eslint <file>`, and curl/browser checks against the dev server — the same pattern already used throughout this codebase's session history. Do not introduce a new test framework.
- Never touch the real account `feggeg@gmail.com`. All manual verification must use disposable test accounts registered through the app's own `/api/auth/register` route, cleaned up (deleted) immediately after each task's verification.
- The dev server must be started via the project's preview tooling (not raw `npm run dev` in a way that leaves orphan processes) — reuse whatever dev server is already running if one is; otherwise start one and stop it when this plan is fully done.

---

### Task 1: Extend the session data model

**Files:**
- Modify: `src/lib/session.ts` (entire file, currently 21 lines)

**Interfaces:**
- Produces: `SavedAccount` interface `{ userId: string; email: string; displayName: string }`, and `SessionData.savedAccounts?: SavedAccount[]` — every later task imports `SavedAccount` from `@/lib/session`.

- [ ] **Step 1: Replace the file contents**

Replace all of `src/lib/session.ts` with:

```ts
import { cookies } from "next/headers";
import { getIronSession, IronSession } from "iron-session";

export interface SavedAccount {
  userId: string;
  email: string;
  displayName: string;
}

export interface SessionData {
  userId?: string;
  // Other accounts logged into on this device — lets Switch Accounts swap
  // the active one instantly without a password. Never includes the
  // current `userId` itself. Capped at 5 entries, enforced in the login
  // route (not here, since this file has no request context).
  savedAccounts?: SavedAccount[];
}

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "gamehub_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit code 0). This is a pure additive type change, so nothing should break yet.

- [ ] **Step 3: Lint**

Run: `npx eslint src/lib/session.ts`
Expected: no output.

---

### Task 2: Login route — support adding a second account

**Files:**
- Modify: `src/app/api/auth/login/route.ts` (entire file, currently 32 lines)

**Interfaces:**
- Consumes: `getSession` from `@/lib/session` (unchanged signature), `type SavedAccount` from `@/lib/session` (Task 1), `getDisplayName` from `@/lib/auth` (existing export, signature `(user: {email, displayName?, accounts?}) => string`).
- Produces: `POST /api/auth/login` now accepts an optional `addAccount: boolean` in the JSON body. When `addAccount` is falsy, behavior is byte-for-byte identical to today except it also explicitly resets `session.savedAccounts = []`. When `addAccount` is `true`, it appends instead of replacing (see step 1). Response shape unchanged (`{ ok: true }` or `{ error: string }`).

- [ ] **Step 1: Replace the file contents**

Replace all of `src/app/api/auth/login/route.ts` with:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, type SavedAccount } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { getDisplayName } from "@/lib/auth";

const MAX_SAVED_ACCOUNTS = 5;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const addAccount = body?.addAccount === true;

  const genericError = NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  if (!email || !password) {
    return genericError;
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { accounts: true } });
  if (!user) {
    return genericError;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return genericError;
  }

  const session = await getSession();

  if (!addAccount) {
    session.userId = user.id;
    session.savedAccounts = [];
    await session.save();
    return NextResponse.json({ ok: true });
  }

  // Adding a second account onto the current session, not replacing it.
  if (session.userId === user.id) {
    return NextResponse.json({ error: "You're already using that account." }, { status: 400 });
  }
  const saved = session.savedAccounts ?? [];
  if (saved.some((a) => a.userId === user.id)) {
    return NextResponse.json(
      { error: "That account's already added — switch to it instead." },
      { status: 400 }
    );
  }
  if (saved.length >= MAX_SAVED_ACCOUNTS) {
    return NextResponse.json({ error: "Remove an account before adding another." }, { status: 400 });
  }

  const nextSaved: SavedAccount[] = [...saved];
  if (session.userId) {
    const current = await prisma.user.findUnique({ where: { id: session.userId }, include: { accounts: true } });
    if (current) {
      nextSaved.push({ userId: current.id, email: current.email, displayName: getDisplayName(current) });
    }
  }

  session.savedAccounts = nextSaved;
  session.userId = user.id;
  await session.save();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npx eslint src/app/api/auth/login/route.ts`
Expected: no output.

- [ ] **Step 4: Manual verification against the dev server**

Ensure the dev server is running on port 3000 (start it if not: use the project's preview tooling, name `gamehub-dev`, per `.claude/launch.json`).

Register two disposable test accounts and log in as the first, saving cookies to files:

```bash
curl -s -c cookies-a.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"switch-test-a@example.com","password":"TestPass1234"}'
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"switch-test-b@example.com","password":"TestPass1234"}'
```

Expected: both return `{"ok":true}`. Note: the register route already logs the caller in as the FIRST account (cookies-a.txt now holds an active session for switch-test-a).

Now try adding account B onto session A:

```bash
curl -s -b cookies-a.txt -c cookies-a.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"switch-test-b@example.com","password":"TestPass1234","addAccount":true}'
```

Expected: `{"ok":true}`.

Confirm the active account is now B and A got saved — check via `/api/me` (Task 5 will make `savedAccounts` show up here; for now just confirm no error and that `user.email` is `switch-test-b@example.com`):

```bash
curl -s -b cookies-a.txt http://localhost:3000/api/me
```

Expected: `user.email` is `"switch-test-b@example.com"`.

Test the duplicate/self-add rejections:

```bash
curl -s -b cookies-a.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"switch-test-b@example.com","password":"TestPass1234","addAccount":true}'
```

Expected: `{"error":"You're already using that account."}` with status 400 (add `-w ' [%{http_code}]\n'` to the curl command if you want the status code printed).

Leave `cookies-a.txt` in place — Task 3 reuses it.

---

### Task 3: New switch route

**Files:**
- Create: `src/app/api/auth/switch/route.ts`

**Interfaces:**
- Consumes: `getSession`, `type SavedAccount` from `@/lib/session`; `getDisplayName` from `@/lib/auth`; `prisma` from `@/lib/prisma`.
- Produces: `POST /api/auth/switch` with body `{ userId: string }` → `{ ok: true }` on success, or `{ error: string }` with status 400/401.

- [ ] **Step 1: Create the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, type SavedAccount } from "@/lib/session";
import { getDisplayName } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";

  const saved = session.savedAccounts ?? [];
  const target = saved.find((a) => a.userId === targetUserId);
  if (!target) {
    return NextResponse.json({ error: "That account isn't saved on this device." }, { status: 400 });
  }

  const targetExists = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!targetExists) {
    // Stale entry (account deleted since being saved) — drop it rather
    // than switching into a dead account.
    session.savedAccounts = saved.filter((a) => a.userId !== targetUserId);
    await session.save();
    return NextResponse.json({ error: "That account no longer exists." }, { status: 400 });
  }

  const current = await prisma.user.findUnique({ where: { id: session.userId }, include: { accounts: true } });
  const nextSaved: SavedAccount[] = saved.filter((a) => a.userId !== targetUserId);
  if (current) {
    nextSaved.push({ userId: current.id, email: current.email, displayName: getDisplayName(current) });
  }

  session.savedAccounts = nextSaved;
  session.userId = target.userId;
  await session.save();

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npx eslint src/app/api/auth/switch/route.ts`
Expected: no output.

- [ ] **Step 4: Manual verification**

Continuing from Task 2 (`cookies-a.txt` is active as `switch-test-b@example.com`, with `switch-test-a` saved). Get account A's `userId` — easiest way: re-register attempt for A will now fail (already exists) so instead query the DB directly:

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('dev.db');
const row = db.prepare('SELECT id FROM User WHERE email = ?').get('switch-test-a@example.com');
console.log(row.id);
db.close();
"
```

Copy the printed id (call it `<A_ID>`), then switch to it:

```bash
curl -s -b cookies-a.txt -c cookies-a.txt -X POST http://localhost:3000/api/auth/switch \
  -H "Content-Type: application/json" \
  -d "{\"userId\":\"<A_ID>\"}"
```

Expected: `{"ok":true}`.

```bash
curl -s -b cookies-a.txt http://localhost:3000/api/me
```

Expected: `user.email` is back to `"switch-test-a@example.com"`.

Test the rejection path (switching to something not in the saved list):

```bash
curl -s -b cookies-a.txt -X POST http://localhost:3000/api/auth/switch \
  -H "Content-Type: application/json" \
  -d '{"userId":"not-a-real-id"}'
```

Expected: `{"error":"That account isn't saved on this device."}`.

---

### Task 4: Logout route — drop active, promote next saved account

**Files:**
- Modify: `src/app/api/auth/logout/route.ts` (entire file, currently 8 lines)

**Interfaces:**
- Consumes: `prisma` from `@/lib/prisma` (new import for this file), `getSession` from `@/lib/session`.
- Produces: `POST /api/auth/logout` still returns `{ ok: true }`, but now only destroys the whole session when there are zero (valid) saved accounts left; otherwise it promotes the next saved account to active and keeps the user logged in as that account.

- [ ] **Step 1: Replace the file contents**

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  let saved = session.savedAccounts ?? [];

  // Walk the saved list until we find one that still exists in the DB —
  // an account could have been deleted since it was saved.
  while (saved.length > 0) {
    const [next, ...rest] = saved;
    const exists = await prisma.user.findUnique({ where: { id: next.userId }, select: { id: true } });
    if (exists) {
      session.userId = next.userId;
      session.savedAccounts = rest;
      await session.save();
      return NextResponse.json({ ok: true });
    }
    saved = rest;
  }

  session.destroy();
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npx eslint src/app/api/auth/logout/route.ts`
Expected: no output.

- [ ] **Step 4: Manual verification**

Continuing from Task 3 (`cookies-a.txt` active as `switch-test-a`, with `switch-test-b` saved). Log out:

```bash
curl -s -b cookies-a.txt -c cookies-a.txt -X POST http://localhost:3000/api/auth/logout
curl -s -b cookies-a.txt http://localhost:3000/api/me
```

Expected: first call returns `{"ok":true}`; second call now shows `user.email` as `"switch-test-b@example.com"` (promoted), NOT `user: null` — proving logout promoted the saved account instead of destroying the session.

Log out again (no saved accounts left this time):

```bash
curl -s -b cookies-a.txt -c cookies-a.txt -X POST http://localhost:3000/api/auth/logout
curl -s -b cookies-a.txt http://localhost:3000/api/me
```

Expected: second call now returns `{"user":null,"savedAccounts":[]}` — fully logged out since nothing was left to promote.

Delete both disposable test accounts from the DB now that this task's verification is done:

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('dev.db');
db.prepare('DELETE FROM User WHERE email IN (?, ?)').run('switch-test-a@example.com', 'switch-test-b@example.com');
db.close();
"
rm -f cookies-a.txt
```

---

### Task 5: Expose savedAccounts via /api/me

**Files:**
- Modify: `src/app/api/me/route.ts` (entire file, currently 23 lines)

**Interfaces:**
- Consumes: `getSession` from `@/lib/session` (new import for this file), `getDisplayName` from `@/lib/auth`.
- Produces: `GET /api/me` response gains two things: `user.displayName` (was missing entirely before) and a top-level `savedAccounts: SavedAccount[]` array (always present, `[]` when there are none or when logged out). This is what `SwitchAccountsMenu` (Task 6) fetches.

- [ ] **Step 1: Replace the file contents**

```ts
import { NextResponse } from "next/server";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  const session = await getSession();
  const savedAccounts = session.savedAccounts ?? [];

  if (!user) {
    return NextResponse.json({ user: null, savedAccounts });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: getDisplayName(user),
      accounts: user.accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        displayName: a.displayName,
        avatarUrl: a.avatarUrl,
        lastSyncedAt: a.lastSyncedAt,
      })),
    },
    savedAccounts,
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npx eslint src/app/api/me/route.ts`
Expected: no output.

- [ ] **Step 4: Manual verification**

Register a fresh disposable account, log in, add a second, and confirm the shape:

```bash
curl -s -c cookies-verify.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -d '{"email":"switch-test-c@example.com","password":"TestPass1234"}'
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -d '{"email":"switch-test-d@example.com","password":"TestPass1234"}'
curl -s -b cookies-verify.txt -c cookies-verify.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"switch-test-d@example.com","password":"TestPass1234","addAccount":true}'
curl -s -b cookies-verify.txt http://localhost:3000/api/me
```

Expected final response: `user.displayName` is present (e.g. `"switch-test-d"`), and `savedAccounts` is an array with one entry whose `email` is `"switch-test-c@example.com"` and `displayName` is present.

Clean up:

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('dev.db');
db.prepare('DELETE FROM User WHERE email IN (?, ?)').run('switch-test-c@example.com', 'switch-test-d@example.com');
db.close();
"
rm -f cookies-verify.txt
```

---

### Task 6: SwitchAccountsMenu component

**Files:**
- Create: `src/components/SwitchAccountsMenu.tsx`

**Interfaces:**
- Consumes: `GET /api/me` (Task 5's shape), `POST /api/auth/switch` (Task 3), `POST /api/auth/login` with `addAccount: true` (Task 2). Uses the existing `Avatar` component (`@/components/Avatar`, props `{name: string, size?: number}`) and `useToast` (`@/context/ToastContext`, `{ showToast(message: string, type: "success"|"error") }`).
- Produces: `export default function SwitchAccountsMenu(): JSX.Element` — no props. Self-contained: fetches its own data, manages its own open/closed and add-account-modal state. Task 7 just renders `<SwitchAccountsMenu />` with no props.

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Check, Users, UserPlus, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useToast } from "@/context/ToastContext";

interface SavedAccountInfo {
  userId: string;
  email: string;
  displayName: string;
}

interface MeResponse {
  user: { id: string; email: string; displayName: string } | null;
  savedAccounts: SavedAccountInfo[];
}

// A real Discord-style account switcher — up to 5 accounts can be
// logged into on this device at once (see docs/superpowers/specs/
// 2026-07-31-switch-accounts-design.md). Self-contained: fetches its own
// /api/me data the first time it's opened, so the parent (FriendProfileModal)
// doesn't need to know anything about the saved-accounts list.
export default function SwitchAccountsMenu() {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [adding, setAdding] = useState(false);

  async function loadMe() {
    const res = await fetch("/api/me");
    const data = (await res.json()) as MeResponse;
    setMe(data);
    setLoaded(true);
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) loadMe();
  }

  async function switchTo(userId: string) {
    setSwitchingTo(userId);
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        showToast(data.error ?? "Couldn't switch accounts.", "error");
      }
    } finally {
      setSwitchingTo(null);
    }
  }

  async function submitAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, password: addPassword, addAccount: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setAddOpen(false);
        setAddEmail("");
        setAddPassword("");
        router.push("/dashboard");
        router.refresh();
      } else {
        showToast(data.error ?? "Couldn't add that account.", "error");
      }
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/30 text-xs text-foreground">
      <button
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-surface-2/60"
      >
        <span className="flex items-center gap-2">
          <Users size={13} />
          Switch Accounts
        </span>
        <ChevronRight size={13} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/60 py-1">
          {!loaded ? (
            <p className="px-4 py-2 text-muted">Loading…</p>
          ) : (
            <>
              {me?.user && (
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <Avatar name={me.user.displayName} size={20} />
                  <span className="min-w-0 flex-1 truncate">{me.user.displayName}</span>
                  <Check size={13} className="shrink-0 text-accent-bright" />
                </div>
              )}
              {me?.savedAccounts.map((acc) => (
                <button
                  key={acc.userId}
                  onClick={() => switchTo(acc.userId)}
                  disabled={switchingTo === acc.userId}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-surface-2/60"
                >
                  <Avatar name={acc.displayName} size={20} />
                  <span className="min-w-0 flex-1 truncate">{acc.displayName}</span>
                </button>
              ))}
              <button
                onClick={() => setAddOpen(true)}
                className="flex w-full items-center gap-2 border-t border-border/60 px-4 py-1.5 text-left text-accent-bright transition-colors hover:bg-surface-2/60"
              >
                <UserPlus size={13} />
                Add Another Account
              </button>
            </>
          )}
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
          onClick={() => setAddOpen(false)}
        >
          <form
            onSubmit={submitAddAccount}
            onClick={(e) => e.stopPropagation()}
            className="panel relative w-full max-w-xs !p-5 text-left"
          >
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="absolute right-3 top-3 text-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Add Another Account</h2>
            <input
              type="email"
              required
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Email"
              className="input-field mb-2 w-full"
            />
            <input
              type="password"
              required
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              placeholder="Password"
              className="input-field mb-4 w-full"
            />
            <button type="submit" disabled={adding} className="btn-primary w-full">
              Log In
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 3: Lint**

Run: `npx eslint src/components/SwitchAccountsMenu.tsx`
Expected: no output. If `react-hooks/set-state-in-effect` or similar fires on a hook you didn't expect, this component has no `useEffect` at all, so it shouldn't — if some other rule fires, fix it inline the same way prior components in this codebase have (e.g. an `eslint-disable-next-line` comment matching the established pattern) rather than restructuring the component.

---

### Task 7: Wire SwitchAccountsMenu into FriendProfileModal

**Files:**
- Modify: `src/components/FriendProfileModal.tsx:333-379` (the closing action-rows `<div>` — currently contains Edit Profile, the status picker, and Copy User ID)

**Interfaces:**
- Consumes: `SwitchAccountsMenu` default export from `@/components/SwitchAccountsMenu` (Task 6, no props).

- [ ] **Step 1: Add the import**

In `src/components/FriendProfileModal.tsx`, add this import alongside the other component imports near the top of the file (after the `RoleChip` import):

```ts
import SwitchAccountsMenu from "@/components/SwitchAccountsMenu";
```

- [ ] **Step 2: Render it between the status picker and Copy User ID**

Find this exact block (the end of the status-picker `{isSelf && (...)}` and the start of the Copy User ID button):

```tsx
                  )}
                </div>
              )}
              <button
                onClick={copyUserId}
```

Replace it with:

```tsx
                  )}
                </div>
              )}
              {isSelf && <SwitchAccountsMenu />}
              <button
                onClick={copyUserId}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 4: Lint**

Run: `npx eslint src/components/FriendProfileModal.tsx`
Expected: no output.

---

### Task 8: End-to-end browser verification + cleanup

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Use the project's preview tooling to start (or reuse) the `gamehub-dev` dev server on port 3000. If port 3000 is already occupied by something unexpected, ask the user before killing anything — do not assume.

- [ ] **Step 2: Register a disposable second test account**

You'll be logged in as the real account already active in the browser (do not touch `feggeg@gmail.com` or reset its password). Register ONE new disposable account for this test via a normal browser flow or curl:

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"switch-test-browser@example.com","password":"TestPass1234"}'
```

Expected: `{"ok":true}`.

- [ ] **Step 3: Open the profile popup and add the second account**

In the browser, open any profile popup for yourself (self-view) — e.g. click your own row in a server's member list, or the bottom-left panel while inside a server. Confirm you now see a "Switch Accounts" row. Click it — confirm it expands showing your own account (with a checkmark) and an "Add Another Account" row. Click "Add Another Account", fill in `switch-test-browser@example.com` / `TestPass1234`, submit.

Expected: the page navigates to `/dashboard` logged in as the new disposable account (check the bottom-left user panel or navbar shows the new account's email prefix as display name).

- [ ] **Step 4: Switch back**

Open the profile popup again (now viewing the disposable account's own profile), open "Switch Accounts" — confirm your ORIGINAL account now appears in the saved list (not the currently-active one). Click it.

Expected: instantly back to your original account, no password prompt, `/dashboard` loads as you.

- [ ] **Step 5: Verify persistence across reload**

Reload the page. Open the profile popup, open Switch Accounts again.

Expected: the disposable account is still listed as saved (the switcher list survived the reload, since it lives in the session cookie, not component state).

- [ ] **Step 6: Verify Log Out promotes instead of destroying**

While your saved list has one entry (the disposable account), click the top navbar's "Log out" button.

Expected: you are NOT dropped to the landing/login page — you land back in the app already logged in as the disposable account (promoted from `savedAccounts`).

- [ ] **Step 7: Verify final Log Out with nothing left destroys the session**

Click "Log out" again (no saved accounts remain now).

Expected: this time you land on the logged-out landing page.

- [ ] **Step 8: Clean up the disposable account**

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('dev.db');
db.prepare('DELETE FROM User WHERE email = ?').run('switch-test-browser@example.com');
db.close();
"
```

Log back into your real account through the normal landing-page login form (this is the point where you'll need to actually be signed back in — do this via the browser's normal login, never by touching the DB directly for a real account).

- [ ] **Step 9: Final full-project check**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npx eslint .`
Expected: no output.

Stop the dev server if this plan started it fresh.

---

## Self-Review Notes

- **Spec coverage:** session model (Task 1), addAccount login + cap + dedup (Task 2), switch (Task 3), logout promote-or-destroy incl. stale-entry handling (Task 4), `/api/me` exposure (Task 5), UI submenu + add-account modal (Task 6–7), full end-to-end (Task 8). All spec sections have a task.
- **Type consistency:** `SavedAccount { userId, email, displayName }` is identical across Tasks 1, 2, 3. `SwitchAccountsMenu`'s local `SavedAccountInfo` mirrors it structurally (kept as a separate local interface in Task 6 since components shouldn't import server-only session types, but the shape matches exactly — verified field-by-field against Task 1's `SavedAccount`).
- **No placeholders:** every task has complete, runnable code and exact verification commands with expected output — no "add validation" or "TBD" left anywhere.
