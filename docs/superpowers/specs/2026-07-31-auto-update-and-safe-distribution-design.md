# Auto-Update and Safe Distribution — Design Spec

Date: 2026-07-31

## Goal

Let the developer ship Game Hub (the Electron desktop app) to friends and push
out updates afterward without anyone needing to manually download and
reinstall — a Discord-style in-app "Update available — Update Now / Later"
prompt, backed by GitHub Releases. Bundled with this: fix three distribution
hazards discovered while scoping this feature, all of which currently ship
the developer's own private data/secrets inside every friend's copy.

This spec covers only what's needed to distribute and update the app safely.
Hardening Firebase's currently-open Realtime Database security rules is a
related but separate concern, explicitly deferred to its own future project
(confirmed with the user) — this spec does not change Firebase rules.

## Context confirmed this session

- `npm run dist` (packaging pipeline: `build:standalone` → `rebuild:native` →
  `electron-builder --win`) was previously blocked on Visual Studio Build
  Tools' C++ workload. That workload is now present on this machine and a
  full packaging run succeeded, producing `release\Game Hub Setup 0.1.0.exe`
  (~299MB). The packaging pipeline itself needs no fixes for that blocker.
- `scripts/prepare-standalone.js` currently copies the developer's real
  `.env` into every packaged build "so a distributed copy has working config
  out of the box." This means every friend's install currently ships with
  the same `SESSION_SECRET` (the iron-session cookie signing key) and the
  same `ADMIN_EMAIL` value as the developer's own environment.
- `package.json`'s `build.extraResources` copies the developer's live
  `dev.db` into `standalone/dev.db` in every packaged build — friends
  currently receive a copy of the developer's real database on first install.
- `src/lib/admin.ts`'s `isAdminEmail()` already guards against an empty
  `ADMIN_EMAIL` (`!!adminEmail && ...`), so removing `ADMIN_EMAIL` from a
  packaged `.env` safely means nobody is admin on that install — no code
  change needed there.
- Admin status gates real actions that reach the shared Firebase relay used
  by every install (moderation bans/mutes/warns at `/moderation/{code}`,
  broadcast announcements) — not just local-only conveniences. This is why
  a shared, guessable `ADMIN_EMAIL` baked into every friend's copy is a real
  risk: anyone could register that exact email on their own local install
  and gain the ability to moderate or broadcast against the whole friend
  group.
- No git remote exists yet (git was only initialized locally, for the
  Switch Accounts feature). GitHub Releases requires pushing to a real
  GitHub repository first.

## Global Constraints

- Public GitHub repository (confirmed) — the public/private choice only
  affects source code visibility, not app security; a private repo would
  need a GitHub token embedded in every distributed copy, which any friend
  could extract, so public is both simpler and safer for this use case.
- Update prompt must never install without an explicit "Update Now" click —
  no silent/forced updates.
- Firebase Realtime Database security rules are explicitly out of scope for
  this spec.
- No new backend/server — GitHub Releases is a static artifact host, not a
  service the app depends on beyond checking/downloading files; this does
  not change the project's "local-first, no central server for user data"
  architecture.

## Architecture

### 1. Update mechanism

Add `electron-updater` (same publisher/ecosystem as the already-used
`electron-builder`). In `electron/main.js`:

- After `createWindow()` succeeds in `app.whenReady()`, call
  `autoUpdater.checkForUpdates()`. Also re-check on a timer (every 4 hours)
  while the app stays alive in the tray, since the app is designed to keep
  running in the background rather than being relaunched often.
- `autoUpdater` only runs when `app.isPackaged` is true (skip entirely in
  dev, matching the existing `startServer()` packaged/unpackaged branch).
- On the `update-available` event, show a native
  `dialog.showMessageBox` (non-blocking, `type: "info"`) with two buttons:
  "Update Now" and "Later" — no new IPC/preload plumbing needed, consistent
  with how the existing tray menu is built directly in the main process.
- "Update Now" → `autoUpdater.downloadUpdate()` → on `update-downloaded` →
  `autoUpdater.quitAndInstall()` (quits and relaunches into the new version
  automatically). "Later" just dismisses; the next periodic check will
  prompt again.
- On the `error` event, log and silently skip — a failed update check must
  never block the app from working normally.

### 2. electron-builder publish config

Add a `publish` block to `package.json`'s `build` section:
```json
"publish": { "provider": "github", "owner": "<github-username>", "repo": "game-hub" }
```
`<github-username>` is confirmed at implementation time (the user's actual
GitHub account) — this is a configuration value, not a design decision.
With this in place, `npm run dist` (electron-builder) automatically also
produces `latest.yml` alongside the installer — the metadata file
`electron-updater` reads to know the newest available version.

### 3. Per-install secret generation (no more shared SESSION_SECRET)

Packaged (`app.isPackaged`) runs generate their own `SESSION_SECRET` on
first launch instead of using the bundled `.env`'s value:

- In `electron/main.js`, before `startServer()`, check for
  `path.join(app.getPath("userData"), "secrets.json")`. If absent, generate
  `{ sessionSecret: crypto.randomBytes(32).toString("hex") }` and write it.
  Either way, read the value and pass it into the spawned server's `env` as
  `SESSION_SECRET`, overriding whatever `.env` in the standalone bundle
  contains.
- Unpackaged dev runs (`npm run dev` / `npm run desktop` with
  `app.isPackaged === false`) are untouched — they keep using `.env`'s
  `SESSION_SECRET` exactly as today.
- This makes every friend's install cryptographically independent — no two
  installs can ever decrypt or forge each other's session cookies.

### 4. No shared ADMIN_EMAIL in packaged copies

`scripts/prepare-standalone.js`'s `.env`-copying step is changed to write a
**modified** copy into the standalone output: same file, with the
`ADMIN_EMAIL=...` line stripped before writing. The developer's real
`.env` at the project root is never modified — only the copy that ships
inside the package. Since `isAdminEmail()` already returns `false` when
`ADMIN_EMAIL` is unset, this alone is sufficient: nobody is admin on a
friend's install, with no other code changes required. (The developer's
own unpackaged dev environment keeps `ADMIN_EMAIL` from their real `.env`,
unaffected.)

### 5. Fresh (empty) database on every packaged install

`package.json`'s `build.extraResources` currently ships the developer's
live `dev.db`. Replace this with a freshly-migrated, empty SQLite file
generated at package time (not a hand-maintained template that could drift
from schema changes): a small script runs Prisma's migrations against a
throwaway empty `.db` file as part of `npm run dist`, and *that* file is
what `extraResources` copies to `standalone/dev.db` — guaranteeing an
empty-but-current-schema database for every fresh install, generated fresh
on every build rather than checked into the repo.

## GitHub setup (one-time)

Push the existing local repository to a new **public** GitHub repo (name
confirmed at implementation time, defaulting to `game-hub`). This is a
prerequisite for the `publish` config in Architecture section 2 — it needs
a real `owner/repo` to point at.

## Release workflow (going forward)

Manual, matching this project's existing "no extra tooling beyond what's
needed" pattern:
1. Bump the version in `package.json`.
2. `npm run dist` — produces the installer, `latest.yml`, and blockmap in
   `release/`.
3. Publish a GitHub Release for that version tag, attaching the installer,
   `latest.yml`, and blockmap as release assets (via `gh release create` or
   GitHub's web UI).
4. Every friend's already-running copy picks up the new version on its next
   periodic check (within 4 hours) or next launch, and shows the update
   prompt.

## Out of scope

- Firebase Realtime Database security rules (separate future project).
- Release automation/CI (kept manual for now — can revisit if it becomes
  tedious).
- Any change to the actual update UI beyond a native dialog (no custom
  in-app banner UI in the Next.js frontend for v1).
- Removing/rotating the *currently already-shared* `SESSION_SECRET`/
  `ADMIN_EMAIL` for copies already distributed before this feature ships —
  this only fixes future distributions going forward.
