# Auto-Update and Safe Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Game Hub (the Electron desktop app) be safely handed to friends and updated afterward via an in-app "Update available — Update Now / Later" prompt backed by GitHub Releases, without shipping the developer's real secrets or database to every copy.

**Architecture:** `electron-updater` checks a public GitHub repo's Releases for a newer version and prompts via a native `dialog.showMessageBox` — never silent. Packaged (not dev) runs generate their own `SESSION_SECRET` on first launch and never receive the developer's real `ADMIN_EMAIL` or live database; both are stripped/replaced at package time.

**Tech Stack:** Electron 43, `electron-builder` (already a dependency), `electron-updater` (new), Node's built-in `crypto`/`fs`, Prisma migrations (for generating an empty packaged database).

## Global Constraints

- Update prompt must never install without an explicit "Update Now" click — no silent/forced updates.
- GitHub repo is public (confirmed) — no token embedded in the app.
- Firebase Realtime Database security rules are explicitly out of scope for this plan (deferred to a separate future project).
- This repo has no test-runner configured. Every task's verification uses `node --check` (syntax), `npx tsc --noEmit`, `npx eslint`, and direct manual checks (inspecting generated files, running scripts directly) — do not introduce a new test framework.
- Packaged/friend copies must never contain: the developer's real `SESSION_SECRET`, the developer's real `ADMIN_EMAIL`, or the developer's real `dev.db` data. The developer's own unpackaged dev environment (`npm run dev` / `app.isPackaged === false`) is unaffected by every fix in this plan.

---

### Task 1: Strip SESSION_SECRET and ADMIN_EMAIL from the packaged `.env`

**Files:**
- Modify: `scripts/prepare-standalone.js` (entire file, currently 33 lines)

**Interfaces:**
- Produces: `.next/standalone/.env` (written by this script) never contains a `SESSION_SECRET=` or `ADMIN_EMAIL=` line, regardless of what the project root `.env` contains. Every other line from the root `.env` is preserved as-is. Task 2 depends on this: it only works correctly because the bundled `.env` no longer sets `SESSION_SECRET` at all, so there is nothing for its injected value to conflict with.

- [ ] **Step 1: Replace the `.env`-copying block**

Replace this existing block near the bottom of `scripts/prepare-standalone.js`:

```js
// Bundle .env so a distributed copy has working config (Steam API key,
// session secret, admin email) out of the box — matching the "give a copy to
// a friend and it just works" goal. Next's standalone server reads .env from
// its own working directory automatically.
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  fs.copyFileSync(envPath, path.join(standaloneDir, ".env"));
  console.log("Copied .env into .next/standalone.");
} else {
  console.warn("No .env found at project root — packaged app will be missing its config.");
}
```

with:

```js
// Bundle .env so a distributed copy has working config (Steam API key,
// Firebase config, etc.) out of the box — matching the "give a copy to a
// friend and it just works" goal. Next's standalone server reads .env from
// its own working directory automatically.
//
// SESSION_SECRET and ADMIN_EMAIL are stripped before writing: SESSION_SECRET
// is generated fresh per install by electron/main.js (so no two installs
// ever share a session-signing key), and ADMIN_EMAIL staying out entirely
// means nobody but the developer's own environment is admin — admin status
// gates real actions (moderation, broadcast) that reach the Firebase relay
// shared by every install, so it must never be a value baked into every copy.
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  const envContents = fs.readFileSync(envPath, "utf8");
  const strippedEnv = envContents
    .split("\n")
    .filter((line) => !/^\s*(SESSION_SECRET|ADMIN_EMAIL)\s*=/.test(line))
    .join("\n");
  fs.writeFileSync(path.join(standaloneDir, ".env"), strippedEnv);
  console.log("Copied .env into .next/standalone (SESSION_SECRET/ADMIN_EMAIL stripped).");
} else {
  console.warn("No .env found at project root — packaged app will be missing its config.");
}
```

- [ ] **Step 2: Syntax-check the script**

Run: `node --check scripts/prepare-standalone.js`
Expected: no output (exit code 0).

- [ ] **Step 3: Run it for real and verify the stripped output**

```bash
npx next build
node scripts/prepare-standalone.js
```

Then check the result:

```bash
grep -c "SESSION_SECRET\|ADMIN_EMAIL" .next/standalone/.env
```

Expected: `0`.

Confirm other keys survived (pick any two that exist in your root `.env`, e.g.):

```bash
grep -c "NEXT_PUBLIC_FIREBASE_API_KEY\|DATABASE_URL" .next/standalone/.env
```

Expected: `2` (both lines present, unchanged).

- [ ] **Step 4: Commit**

```bash
git add scripts/prepare-standalone.js
git commit -m "Strip SESSION_SECRET and ADMIN_EMAIL from the packaged .env"
```

---

### Task 2: Per-install SESSION_SECRET generation in the Electron main process

**Files:**
- Modify: `electron/main.js:1-65` (top requires + `startServer()`)

**Interfaces:**
- Consumes: Task 1's fix (the bundled `.env` no longer sets `SESSION_SECRET`).
- Produces: `getOrCreateSessionSecret(): string` — a module-level function in `electron/main.js`. Every packaged run of the app gets its own persistent, randomly-generated secret, stored at `app.getPath("userData")/secrets.json`. Unpackaged (`app.isPackaged === false`) runs are untouched.

- [ ] **Step 1: Add `fs` and `crypto` requires**

At the top of `electron/main.js`, change:

```js
const { app, BrowserWindow, Tray, Menu, nativeImage, session, shell } = require("electron");
const path = require("path");
const http = require("http");
const { spawn } = require("child_process");
```

to:

```js
const { app, BrowserWindow, Tray, Menu, nativeImage, session, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");
```

(`dialog` is added here too — Task 4 needs it, and this is the one place the main `electron` import happens, so adding it now avoids a second edit to the same line later.)

- [ ] **Step 2: Add `getOrCreateSessionSecret()`**

Add this function anywhere before `startServer()` (e.g. right after `waitForServer()`):

```js
// Every packaged install gets its own persistent, randomly-generated
// SESSION_SECRET on first launch — never the developer's own value from a
// bundled .env, since sharing one secret across every friend's copy would
// let any install decrypt or forge another's session cookie.
function getOrCreateSessionSecret() {
  const secretsPath = path.join(app.getPath("userData"), "secrets.json");
  try {
    const existing = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    if (existing.sessionSecret) return existing.sessionSecret;
  } catch {
    // Missing or corrupt — fall through and generate a fresh one.
  }
  const sessionSecret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretsPath, JSON.stringify({ sessionSecret }));
  return sessionSecret;
}
```

- [ ] **Step 3: Inject the generated secret into the spawned server's env**

Change the packaged branch of `startServer()` from:

```js
  const serverPath = path.join(process.resourcesPath, "standalone", "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      // The packaged app has no separate Node.js binary bundled — this tells
      // Electron's own binary to behave as plain Node instead of launching a
      // second GUI instance when we spawn it to run server.js.
      ELECTRON_RUN_AS_NODE: "1",
    },
  });
```

to:

```js
  const serverPath = path.join(process.resourcesPath, "standalone", "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      SESSION_SECRET: getOrCreateSessionSecret(),
      // The packaged app has no separate Node.js binary bundled — this tells
      // Electron's own binary to behave as plain Node instead of launching a
      // second GUI instance when we spawn it to run server.js.
      ELECTRON_RUN_AS_NODE: "1",
    },
  });
```

- [ ] **Step 4: Syntax-check**

Run: `node --check electron/main.js`
Expected: no output (exit code 0).

Full runtime verification (does the packaged app actually start and use a
generated secret) happens in Task 6, once the app can be packaged and run —
`node --check` only confirms this task's edit is syntactically valid
JavaScript.

- [ ] **Step 5: Commit**

```bash
git add electron/main.js
git commit -m "Generate a unique per-install SESSION_SECRET instead of bundling one"
```

---

### Task 3: Generate a fresh empty database at package time

**Files:**
- Create: `scripts/prepare-empty-db.js`
- Modify: `package.json` (`scripts.dist`, `build.extraResources`)

**Interfaces:**
- Produces: running `node scripts/prepare-empty-db.js` creates `prisma/dist-empty.db` — a SQLite file with the current schema fully migrated and zero rows. `prisma/dist-empty.db` matches the existing `*.db*` `.gitignore` pattern already in this repo, so it never needs a separate ignore entry.

- [ ] **Step 1: Create `scripts/prepare-empty-db.js`**

```js
// Generates a fresh, empty (but fully migrated) SQLite database for
// packaging — friends must never receive the developer's real dev.db.
// Regenerated on every `npm run dist` rather than checked into the repo, so
// it can never drift from the current Prisma schema.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const outputPath = path.join(root, "prisma", "dist-empty.db");

if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `file:${outputPath}` },
  shell: true,
});

if (!fs.existsSync(outputPath)) {
  console.error(`Expected a fresh database at ${outputPath} but it wasn't created.`);
  process.exit(1);
}

console.log(`Generated fresh empty database at ${outputPath} for packaging.`);
```

- [ ] **Step 2: Wire it into the `dist` script**

In `package.json`, change:

```json
    "dist": "npm run build:standalone && npm run rebuild:native && electron-builder --win"
```

to:

```json
    "dist": "npm run build:standalone && npm run rebuild:native && node scripts/prepare-empty-db.js && electron-builder --win"
```

- [ ] **Step 3: Point `extraResources` at the generated file**

In `package.json`'s `build.extraResources`, change:

```json
      {
        "from": "dev.db",
        "to": "standalone/dev.db"
      },
```

to:

```json
      {
        "from": "prisma/dist-empty.db",
        "to": "standalone/dev.db"
      },
```

- [ ] **Step 4: Run the script directly and verify**

```bash
node scripts/prepare-empty-db.js
```

Expected: ends with `Generated fresh empty database at ...prisma/dist-empty.db for packaging.`, exit code 0.

Verify it has the schema but no data:

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('prisma/dist-empty.db');
const tables = db.prepare(\"SELECT name FROM sqlite_master WHERE type='table' AND name='User'\").all();
const userCount = db.prepare('SELECT COUNT(*) as c FROM User').get();
console.log('User table exists:', tables.length === 1);
console.log('User row count:', userCount.c);
db.close();
"
```

Expected: `User table exists: true` and `User row count: 0`.

- [ ] **Step 5: Commit**

```bash
git add scripts/prepare-empty-db.js package.json
git commit -m "Package a freshly-migrated empty database instead of the developer's dev.db"
```

---

### Task 4: Add electron-updater with a prompt-before-install flow

**Files:**
- Modify: `electron/main.js` (add updater setup; requires `dialog` already added in Task 2 Step 1)
- Modify: `package.json` (new dependency)

**Interfaces:**
- Consumes: `dialog`, `app` from `electron` (already imported in Task 2). Requires Task 2 to already be applied (shares the same top-of-file require block).
- Produces: `setupAutoUpdater()` — a module-level function in `electron/main.js`, called once from inside `app.whenReady()`.

- [ ] **Step 1: Install the dependency**

Run: `npm install electron-updater`
Expected: `package.json`'s `dependencies` gains an `"electron-updater": "^..."` entry (npm picks the current version — do not hand-edit a version number).

- [ ] **Step 2: Add the updater require**

Near the top of `electron/main.js`, alongside the other requires, add:

```js
const { autoUpdater } = require("electron-updater");
```

- [ ] **Step 3: Add `setupAutoUpdater()`**

Add this function anywhere before the `app.whenReady()` block (e.g. right after `updateDiscordPresence()`):

```js
// Checks GitHub Releases for a newer version and prompts before doing
// anything — never a silent/forced update. Only runs in packaged builds;
// there is nothing to "update" in a dev checkout.
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours — the app is
// designed to keep running in the tray for long stretches, so a single
// on-launch check isn't enough to reach people in a reasonable time.

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", async (info) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update available",
      message: `Game Hub ${info.version} is available. Update now?`,
      buttons: ["Update Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", () => {
    autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (err) => {
    // A failed update check must never block the app from working normally.
    console.error("Auto-update check failed:", err);
  });

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
}
```

- [ ] **Step 4: Call it from `app.whenReady()`**

Change:

```js
  createWindow();
  createTray();
  setupDiscordPresence();
```

to:

```js
  createWindow();
  createTray();
  setupDiscordPresence();
  setupAutoUpdater();
```

- [ ] **Step 5: Syntax-check**

Run: `node --check electron/main.js`
Expected: no output (exit code 0).

Full runtime verification (does a real "Update available" dialog appear and
does clicking through it work) requires two published GitHub Releases to
check between, which don't exist yet at this point in the plan — covered as
a follow-up note in Task 6, not fully verifiable here.

- [ ] **Step 6: Commit**

```bash
git add electron/main.js package.json package-lock.json
git commit -m "Add electron-updater with a prompt-before-install update flow"
```

---

### Task 5: Push to GitHub (public) and wire the electron-builder publish config

**⚠️ Controller note — do not dispatch this task to a subagent until BOTH of these are already confirmed with the human partner:**
1. **The exact GitHub username and desired repo name** (a real external value only they know — never guess it).
2. **Explicit approval to create a new public GitHub repository and push this project's code to it** — this is both "downloading/creating external resources" and "pushing code," both of which require the human partner's explicit go-ahead in the moment, not just the earlier design approval. Confirm this even though the design was already approved — approval to a design is not the same as approval to execute an irreversible, externally-visible action.

Once both are confirmed, this task itself is mechanical.

**Files:**
- Modify: `package.json` (`build.publish`)
- No other files — this task is git/GitHub operations plus one config block.

**Interfaces:**
- Consumes: `<github-username>` and `<repo-name>` — confirmed by the controller before this task starts (see note above).
- Produces: a live public GitHub repository containing this project's current `master` branch; `package.json`'s `build.publish` block, consumed by `electron-builder` in Task 6.

- [ ] **Step 1: Add the publish config**

In `package.json`'s `build` section, add (alongside the existing `appId`, `productName`, etc. keys):

```json
    "publish": {
      "provider": "github",
      "owner": "<github-username>",
      "repo": "<repo-name>"
    },
```

Replace `<github-username>` and `<repo-name>` with the confirmed real values — never leave the angle-bracket placeholders in the committed file.

- [ ] **Step 2: Create the GitHub repo and push**

Using the confirmed owner/repo name (example uses `game-hub` as the repo name — substitute the real confirmed value):

```bash
gh repo create <github-username>/<repo-name> --public --source=. --remote=origin
git push -u origin master
```

If `gh` isn't authenticated, `gh auth login` first (interactive — hand this
step to the human partner rather than attempting it non-interactively).

- [ ] **Step 3: Verify**

```bash
git remote -v
```

Expected: `origin` points at `https://github.com/<github-username>/<repo-name>.git` (or the SSH equivalent).

```bash
gh repo view <github-username>/<repo-name> --json visibility
```

Expected: `{"visibility":"PUBLIC"}`.

- [ ] **Step 4: Commit the publish config**

```bash
git add package.json
git commit -m "Add electron-builder publish config for GitHub Releases"
git push
```

---

### Task 6: Full packaging run and end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full packaging pipeline**

```bash
npm run dist
```

Expected: completes successfully, producing `release/Game Hub Setup <version>.exe`, `release/latest.yml`, and a `.blockmap` file (electron-builder generates `latest.yml` automatically once `build.publish` is configured — its presence confirms Task 5's config is wired correctly).

- [ ] **Step 2: Verify the packaged app has no leaked secrets**

```bash
grep -c "SESSION_SECRET\|ADMIN_EMAIL" .next/standalone/.env
```

Expected: `0` (re-confirms Task 1 held through a full `dist` run, not just the isolated script run).

- [ ] **Step 3: Verify the packaged database is empty**

```bash
node -e "
const Database = require('better-sqlite3');
const db = new Database('prisma/dist-empty.db');
const userCount = db.prepare('SELECT COUNT(*) as c FROM User').get();
console.log('User row count:', userCount.c);
db.close();
"
```

Expected: `User row count: 0`.

- [ ] **Step 4: Install the packaged app on this machine and confirm first launch works**

Run `release\Game Hub Setup <version>.exe`, complete the install, launch it, and confirm:
- It reaches the login screen (proves the fresh empty database + generated
  `SESSION_SECRET` work together — a broken session config would fail before
  the login screen ever renders).
- Register a disposable test account through the installed app itself and
  confirm you can log in and reach the dashboard.
- Check `%APPDATA%\Game Hub\secrets.json` (or the equivalent
  `app.getPath("userData")` path shown in the installed app, e.g. via its
  window title bar or logs) exists and contains a `sessionSecret` value.

- [ ] **Step 5: Note the update-flow limitation**

Two published GitHub Releases are needed to actually see the "Update
available" dialog fire end-to-end (the running version must be older than
the latest published release). That can't happen within this plan, since no
release has been published yet. Once ready to ship a first real release:
bump `package.json`'s version, re-run `npm run dist`, and publish a GitHub
Release with the installer + `latest.yml` + blockmap attached — the already-
installed copy from Step 4 will pick it up on its next check (within 4
hours) and show the prompt. Confirm that specific end-to-end path manually
the first time a real update is shipped, since this plan cannot exercise it
in advance.

- [ ] **Step 6: Final project-wide check**

```bash
npx tsc --noEmit
npx eslint .
```

Expected: no output from either.

---

## Self-Review Notes

- **Spec coverage:** update mechanism + prompt UX (Task 4), publish config
  (Task 5), per-install SESSION_SECRET (Tasks 1+2), no shared ADMIN_EMAIL
  (Task 1), fresh empty database (Task 3), GitHub repo setup (Task 5),
  release workflow documented (Task 6 Step 5). All spec sections have a task.
- **Type/name consistency:** `getOrCreateSessionSecret()` (Task 2) and
  `setupAutoUpdater()` (Task 4) are the only two new functions introduced in
  `electron/main.js`; both are referenced with matching names at their call
  sites. `prisma/dist-empty.db` is the one path name used consistently
  across Task 3's script, `package.json`'s `extraResources`, and Task 6's
  verification — checked field-by-field.
- **No placeholders:** the only bracketed values left are
  `<github-username>`/`<repo-name>` in Task 5, which are a real external
  input the controller must obtain from the human partner before dispatching
  that task (called out explicitly in that task's own controller note) —
  not a placeholder standing in for a design decision.
- **Ordering dependency:** Task 2 explicitly depends on Task 1 already being
  applied (the bundled `.env` must have `SESSION_SECRET` stripped before
  Task 2's injected value is the only source) — noted in both tasks'
  Interfaces sections. Task 4 depends on Task 2 having already added the
  `dialog` import and `fs`/`crypto` requires to the same file.
