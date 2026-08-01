# In-App Steam API Key Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let any Game Hub user paste their own Steam Web API key into the app (Connections page) instead of editing a `.env` file or running a PowerShell command, so Steam sync works for every friend's install without a technical setup step.

**Architecture:** A new shared module (`src/lib/installSettings.ts`) owns reading/writing one JSON file (`settings.json`) that lives in the same per-install directory as the existing `secrets.json` (Electron's `userData`, passed to the server as `GAMEHUB_DATA_DIR`) — or the project root in local dev. `src/lib/steam.ts`'s five call sites, which currently each read `process.env.STEAM_API_KEY` directly, are refactored to go through one `getSteamApiKey()` helper that checks the environment variable first (preserving the existing dev workflow) and falls back to the persisted settings file. A new API route lets the client save a key and check whether one is already set (returning only the last 4 characters, never the full value). A new client component on the Connections page provides the paste-and-save UI.

**Tech Stack:** Next.js App Router API routes, Node's `fs`/`path` (server-only), React client component, existing `ToastContext` for feedback.

## Global Constraints

- No automated test framework exists in this project (confirmed: no jest/vitest/playwright in `package.json`). Every task's verification uses `npx tsc --noEmit` and `npx eslint <file>`, plus a real manual check — never fabricated test files.
- The Steam API key is a per-*installation* setting, not per-account — it must never be stored on the Prisma `User` model, and must work regardless of which local account is currently active.
- The full saved key must never be sent back to the browser after the initial save — only its last 4 characters, for a masked-placeholder display.
- A `.env`/environment-variable value for `STEAM_API_KEY` (the existing local-dev workflow) must always take priority over the persisted settings file value.
- No auto-restart mechanism — saving shows a toast telling the user to close and reopen Game Hub themselves. Do not add any Electron IPC/relaunch plumbing for this.

---

### Task 1: Shared install-settings module

**Files:**
- Create: `src/lib/installSettings.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `InstallSettings` interface (`{ steamApiKey?: string }`), `readInstallSettings(): InstallSettings`, `writeInstallSettings(partial: Partial<InstallSettings>): void` — both used by Task 2 (steam.ts) and Task 3 (the new API route).

- [ ] **Step 1: Create the file**

```ts
import fs from "fs";
import path from "path";

export interface InstallSettings {
  steamApiKey?: string;
}

// Where per-install (not per-account) config lives — the same directory
// secrets.json (SESSION_SECRET) already uses. In a packaged Electron build
// this is GAMEHUB_DATA_DIR (the app's userData directory, passed to the
// server process by electron/main.js), which survives every update since
// NSIS only wipes the install directory, never userData. In local dev
// (no Electron, GAMEHUB_DATA_DIR unset) it falls back to the project root.
function settingsPath(): string {
  const dir = process.env.GAMEHUB_DATA_DIR ?? process.cwd();
  return path.join(dir, "settings.json");
}

// Never throws — a missing or malformed settings file just means "nothing
// saved yet", not an error. Callers decide what a missing value means.
export function readInstallSettings(): InstallSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    return JSON.parse(raw) as InstallSettings;
  } catch {
    return {};
  }
}

// Merges with whatever else is already saved, so setting one field never
// wipes another — same pattern this app already uses for group rosters.
export function writeInstallSettings(partial: Partial<InstallSettings>): void {
  const current = readInstallSettings();
  const next = { ...current, ...partial };
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}
```

- [ ] **Step 2: Add the dev-mode settings file to `.gitignore`**

In `.gitignore`, right after the existing `*.db*` / `prisma/dev.db*` block, add:

```
# per-install settings written by the in-app Steam API key panel (dev-mode
# fallback path only — packaged builds write this into userData instead)
/settings.json
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit` and `npx eslint src/lib/installSettings.ts`
Expected: both clean, no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/installSettings.ts .gitignore
git commit -m "Add shared per-install settings file (read/write helpers)"
```

---

### Task 2: Refactor `steam.ts` to resolve the API key through the new module

**Files:**
- Modify: `src/lib/steam.ts`

**Interfaces:**
- Consumes: `readInstallSettings` from `src/lib/installSettings.ts` (Task 1).
- Produces: a private `getSteamApiKey(): string` helper, used internally by this file's five exported functions — no change to any of their public signatures.

**Why:** Five call sites in this file each independently do `const apiKey = process.env.STEAM_API_KEY; if (!apiKey) throw new Error("STEAM_API_KEY is not configured");`. Replacing all five with one shared helper means the fallback to a saved settings-file key only needs to be written once.

- [ ] **Step 1: Add the import and the shared helper**

At the top of `src/lib/steam.ts`, add:

```ts
import { readInstallSettings } from "@/lib/installSettings";
```

Right after the two `const` lines at the top of the file (`STEAM_OPENID_ENDPOINT`, `STEAM_API_BASE`), add:

```ts
// The env var always wins (unchanged local-dev workflow: .env or a
// PowerShell-set environment variable). Falling back to the persisted
// settings file is what lets a packaged install work without either.
function getSteamApiKey(): string {
  if (process.env.STEAM_API_KEY) return process.env.STEAM_API_KEY;
  const settings = readInstallSettings();
  if (settings.steamApiKey) return settings.steamApiKey;
  throw new Error("STEAM_API_KEY is not configured");
}
```

- [ ] **Step 2: Replace all five duplicated blocks**

In `fetchOwnedGames` (currently lines 57-58):

```ts
  const apiKey = process.env.STEAM_API_KEY;
  if (!apiKey) throw new Error("STEAM_API_KEY is not configured");
```

becomes:

```ts
  const apiKey = getSteamApiKey();
```

Do the exact same replacement (same before/after text) in `fetchPlayerSummary` (currently lines 85-86), `fetchAchievements` (currently lines 116-117), `fetchFriendsActivity` (currently lines 187-188), and `fetchOwnGameStatus` (currently lines 238-239). Line numbers are from the current file as of this plan being written — grep for `process.env.STEAM_API_KEY` to confirm you've found all five and none have shifted:

Run: `grep -n "process.env.STEAM_API_KEY" src/lib/steam.ts`
Expected: zero matches after this step (all five replaced with `getSteamApiKey()`).

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit` and `npx eslint src/lib/steam.ts`
Expected: both clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/steam.ts
git commit -m "Resolve Steam API key through the shared install-settings fallback"
```

---

### Task 3: API route to save/check the key

**Files:**
- Create: `src/app/api/settings/steam-api-key/route.ts`

**Interfaces:**
- Consumes: `getCurrentUser` from `@/lib/auth`; `readInstallSettings`/`writeInstallSettings` from `@/lib/installSettings` (Task 1).
- Produces: `GET` → `{ configured: false } | { configured: true, lastFour: string }`. `POST` (body `{ apiKey: string }`) → `{ ok: true, lastFour: string }` on success, or `{ error: string }` with a 400/401/500 status on failure.

- [ ] **Step 1: Create the file**

```ts
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readInstallSettings, writeInstallSettings } from "@/lib/installSettings";

// Not admin-gated: this is a per-install convenience setting, not a
// moderation/broadcast privilege — any signed-in user on this install
// should be able to set it for themselves.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = readInstallSettings();
  if (!settings.steamApiKey) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({ configured: true, lastFour: settings.steamApiKey.slice(-4) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Enter your Steam API key." }, { status: 400 });
  }

  try {
    writeInstallSettings({ steamApiKey: apiKey });
  } catch {
    return NextResponse.json({ error: "Couldn't save the key. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lastFour: apiKey.slice(-4) });
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit` and `npx eslint src/app/api/settings/steam-api-key/route.ts`
Expected: both clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/settings/steam-api-key/route.ts
git commit -m "Add API route to save/check the install's Steam API key"
```

---

### Task 4: UI panel on the Connections page, end-to-end verification

**Files:**
- Create: `src/components/SteamApiKeyPanel.tsx`
- Modify: `src/app/(app)/connect/page.tsx`

**Interfaces:**
- Consumes: `useToast` from `@/context/ToastContext`; `GET`/`POST /api/settings/steam-api-key` (Task 3).

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect, useState } from "react";
import { KeyRound, ExternalLink } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function SteamApiKeyPanel() {
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [lastFour, setLastFour] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/steam-api-key")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setLastFour(data.configured ? data.lastFour : null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) {
      showToast("Enter your Steam API key.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/steam-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the key.");
      setLastFour(data.lastFour);
      setApiKey("");
      showToast("Saved — close and reopen Game Hub for it to take effect.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save the key.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel p-4">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <KeyRound size={15} className="text-accent-bright" />
        Steam API Key
      </h2>
      <p className="mb-3 text-xs text-muted">
        Needed for your library to actually sync.{" "}
        <a
          href="https://steamcommunity.com/dev/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent-bright hover:underline"
        >
          Get your own free key <ExternalLink size={11} />
        </a>{" "}
        then paste it below.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={lastFour ? `••••••••${lastFour}` : "Paste your Steam API key…"}
          className="input-field flex-1"
        />
        <button onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
          {lastFour ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into the Connections page**

In `src/app/(app)/connect/page.tsx`, add the import at the top:

```ts
import SteamApiKeyPanel from "@/components/SteamApiKeyPanel";
```

Add `<SteamApiKeyPanel />` as the last child inside the `<div className="mt-6 flex flex-col gap-3">` container — right after the closing `</div>` of the existing Epic Games Store row, still before that container's own closing `</div>`:

```tsx
        <div className="flex items-center justify-between rounded-xl border border-dashed border-border/70 bg-surface/20 p-4">
          <div className="flex items-center gap-3">
            <PlatformBadge platform="EPIC" />
            <span className="text-sm text-muted">Epic Games Store</span>
          </div>
          <span className="text-xs text-muted" title="Epic has no public API for reading a user's owned games yet">
            Coming soon
          </span>
        </div>

        <SteamApiKeyPanel />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and lint the whole project**

Run: `npx tsc --noEmit` and `npx eslint .`
Expected: both clean.

- [ ] **Step 4: Manual end-to-end verification**

This is the only reliable way to prove the fallback path (not just the dev-mode `.env` path) actually works:

1. Comment out (don't delete) the `STEAM_API_KEY=` line in the project's `.env`, so the environment-variable path is genuinely unavailable and the settings-file fallback is what gets exercised.
2. Restart the dev server, log in, go to `/connect`.
3. Confirm the "Steam API Key" panel renders with an empty input and a "Save" button (not "Update").
4. Paste a real Steam Web API key (from `steamcommunity.com/dev/apikey`) and click Save. Confirm the toast reads "Saved — close and reopen Game Hub for it to take effect."
5. Confirm `settings.json` now exists at the project root and contains `{"steamApiKey": "<the key you pasted>"}`.
6. Reload `/connect`. Confirm the input's placeholder now shows `••••••••` followed by the real last 4 characters, and the button now reads "Update".
7. If a Steam account is linked on this test account, trigger a library sync and confirm it succeeds — proving `getSteamApiKey()`'s settings-file fallback (not the env var, which is still commented out) is what the sync call actually used.
8. Clean up: restore the `STEAM_API_KEY=` line in `.env`, and delete the test `settings.json` (it's gitignored, but leaving stray test data around is untidy).

- [ ] **Step 5: Commit**

```bash
git add src/components/SteamApiKeyPanel.tsx "src/app/(app)/connect/page.tsx"
git commit -m "Add Steam API Key panel to the Connections page"
```
