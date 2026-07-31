# Game Hub

A unified game library dashboard — connect your Steam (and eventually Epic, GOG, Xbox,
PlayStation) accounts and see every game you own in one place, with search, filters,
playtime stats, and a dashboard overview.

## Stack

- **Next.js (App Router)** — frontend + backend API routes, one project
- **Tailwind CSS v4** — dark charcoal + neon-orange theme
- **Prisma + SQLite** — stores users, linked platform accounts, and cached library data
- **Email + password auth** — your Game Hub account (login) is separate from any game
  platform. bcrypt-hashed passwords, iron-session for the signed httpOnly cookie.
- **Steam Web API + OpenID** — a post-login **connection**, not a login method: sign in
  with email/password first, then link Steam from the Connections page
- **Epic Games Store** — stubbed as "Coming Soon": Epic has no public API for reading a
  user's owned games library, so real integration is deferred to Phase 2 pending research
  into current options.
- **Electron** — optional desktop window wrapper (`npm run desktop`)
- **Two themes** — Neon Orange (default) and Dark Red, toggled from the navbar, persisted
  in `localStorage`, built on CSS custom properties so no component needed to change
- **Framer Motion** — card hover/tap spring, staggered library entrance, page fade/slide
  transitions, shimmer loading skeletons (`loading.tsx` per route)
- **UI sounds** — short synthesized click/hover/success tones (Web Audio API, no audio
  files needed), mute toggle in the navbar
- **Shared playlist** — one app-wide playlist everyone hears the same tracks from.
  Only the admin account (`ADMIN_EMAIL`) can upload/remove tracks (MP3/WAV/OGG/M4A/FLAC);
  everyone else just gets a persistent mini player (play/pause/skip/shuffle/volume) that
  keeps playing across navigation, with an autoplay-blocked fallback prompt. Copy the
  project (with `dev.db` and `uploads/music/`) to give someone else the same playlist
  pre-loaded.
- **Launch games** — a Play button (card overlay + detail page) that hands off to your
  local Steam client via `steam://run/<appid>`
- **Ratings & notes** — rate any owned game 1-5 stars and jot private notes, right from
  the library grid or the game detail page (auto-saves on blur)
- **Random game picker** — a dashboard card that weight-randomly suggests something from
  your library, favoring games you haven't played recently (or ever); "Try another" to reroll
- **Recent activity chart** — horizontal bar chart of your last-2-weeks playtime per game
  on the dashboard
- **Toast notifications** — non-blocking toast popups for connection success/failure,
  errors, and other feedback, in addition to the existing UI sounds
- **System tray + auto-start** (desktop app) — closing the window minimizes to the system
  tray instead of quitting, so the music keeps playing; right-click the tray icon for
  "Open Game Hub", "Start with Windows", and "Quit Game Hub"
- **Improved playlist** — upload progress bar (real byte progress, not a spinner), a seek
  bar with mm:ss labels on the persistent mini player, and up/down reordering controls
  (admin-only)
- **Animated, theme-reactive background** — drifting blurred aurora blobs, a faint grid,
  and a film-grain texture behind every page, colored entirely from the active theme's
  accent so it re-colors instantly on theme toggle, no JS required
- **Glass UI throughout** — sticky blurred navbar/sidebar, a sliding active-page indicator,
  gradient buttons with a shine-sweep hover animation, and consistent glass panel styling
  across every page
- **Real installed-game detection** — reads Steam's own local library files
  (`libraryfolders.vdf`) on each sync to know exactly which games are actually installed
  on this PC, instead of relying on a manual per-game toggle (Windows only)
- **Saved Views & bulk actions** — save a named filter/sort combo as a one-click shortcut
  in the Library, and multi-select games to bulk mark them installed/not installed
- **System tray quick launch** — right-click the tray icon to launch your most-played
  Steam games directly, without opening the main window
- **Playtime trend chart** — a longer-range view (weekly, since first tracked) of how much
  you've played, derived from snapshots taken on every sync, alongside the existing
  last-2-weeks-per-game chart
- **Achievement unlock alerts** — sync detects newly-unlocked Steam achievements (only for
  games actually played since the last sync, so it stays fast) and surfaces them as a toast
  plus a native OS notification when running as the desktop app
- **Screenshot gallery** — game detail pages show real screenshots pulled from Steam's
  public store API, with a full-screen lightbox (prev/next, click-through)
- **Friends playing now** — a dashboard panel showing which Steam friends are currently
  online/in-game (requires your Steam friends list to be set to Public)
- **Tags & Backlog** — tag any game with custom labels, mark it as backlog, and filter the
  library by status (Installed / Not Installed / Backlog / Never Played) or by tag
- **Unified Achievements page** — a rolled-up view across every game with tracked
  achievement data, plus a slim progress bar on each library card
- **Theme Editor** — a full custom accent color picker (any color, not just the two
  presets) and background controls (intensity slider, grid/grain toggles), all applied
  live and remembered per device
- **Mock in-app Store** — a lighthearted points economy earned from real usage (syncing,
  unlocking achievements, logging new playtime) spendable on cosmetic profile flair
  (animated avatar frames, name badges). Entirely local/personal — no real payments,
  no server-side entitlement tracking, just a fun reward loop
- **Auto-sync** — the library quietly re-syncs every 20 minutes while the app is open, no
  button click needed; stays silent unless there's an achievement to announce
- **Discord Rich Presence** (desktop app, optional) — shows "Playing X" (from Steam's own
  live status) or "Browsing Game Hub" on your Discord profile. Fully opt-in via
  `DISCORD_CLIENT_ID` in `.env` — a no-op if unset
- **Drag-and-drop playlist reordering** — drag tracks directly by their handle, in addition
  to the existing up/down buttons (admin-only)
- **Big Picture mode** — a couch/controller-friendly full-screen library view with oversized
  cards, arrow-key navigation, and Enter-to-launch (no navbar/sidebar chrome)
- **Recap** — a Spotify-Wrapped-style slideshow of your stats since you started using Game
  Hub: total playtime, most-played game, achievements unlocked, and points earned
- **Friends, chat & voice calls** — a scoped, personal-use Discord-like layer on top of
  the existing local-first architecture:
  - **Friends** — add each other by an 8-character friend code (Friends page), no central
    account directory involved
  - **Presence** — see which friends are online right now
  - **Text chat** — a simple 1:1 chat window per friend (`/chat/[code]`)
  - **Voice calls** — 1:1 voice calls over WebRTC, signaled through Firebase (ringing,
    accept/decline, mute, hang up)
  - **Moderation** — an admin-only panel (`/moderation`, gated by `ADMIN_EMAIL`) to warn
    (shows full-screen on the target's device immediately), mute, timeout, or ban a friend
    by code, blocking their chat/voice access while the restriction is active

  All of this needs a **free Firebase Realtime Database** project — see the "Firebase
  setup" step below. Without it, everything else in Game Hub works exactly as before;
  the Friends/Chat/Moderation pages just show a "not set up yet" notice instead of
  breaking. Every Game Hub install still keeps its own local SQLite database as the
  source of truth for friends, chat history, and moderation logs — Firebase is only
  used as a live relay to reach another installation, and messages/requests are removed
  from it the moment they're delivered and saved locally.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the env file and fill in the values:

   ```bash
   cp .env.example .env
   ```

   - `STEAM_API_KEY` — get one instantly and for free at
     [steamcommunity.com/dev/apikey](https://steamcommunity.com/dev/apikey). Any domain
     works for the "domain name" field during local dev (e.g. `localhost`).
   - `SESSION_SECRET` — any long random string. Generate one with:
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - `NEXT_PUBLIC_BASE_URL` — leave as `http://localhost:3000` for local dev.
   - `ADMIN_EMAIL` — the Game Hub account email that's allowed to manage the shared
     playlist (upload/remove tracks). Everyone else can only listen.
   - `DISCORD_CLIENT_ID` — optional. Enables Discord Rich Presence in the desktop app.
     Leave blank to skip it entirely (it's a no-op without it). Get a free one by creating
     an application at [discord.com/developers/applications](https://discord.com/developers/applications)
     and copying its "Application ID" — no review or approval needed.
   - `NEXT_PUBLIC_FIREBASE_*` — optional, but required for Friends/Chat/Voice/Moderation.
     Leave all of these blank to skip that whole feature set entirely (it degrades
     gracefully — everything else still works). To enable it:
     1. Go to [console.firebase.google.com](https://console.firebase.google.com), create a
        free project (no billing required for this usage level).
     2. In the project, open **Build → Realtime Database** and create a database (test
        mode is fine for personal use between friends).
     3. Open **Project settings → General**, scroll to "Your apps", add a **Web app**, and
        copy the config values it gives you into `NEXT_PUBLIC_FIREBASE_API_KEY`,
        `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`, `NEXT_PUBLIC_FIREBASE_DATABASE_URL`,
        `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`.
     4. Everyone who wants to add each other as friends/chat/call needs to point their own
        `.env` at the **same** Firebase project (it's only used as a shared live relay —
        no one's local game library or account data ever goes through it).

   > **Important:** your Steam profile and game details must be set to **Public**
   > (Steam profile → Edit Profile → Privacy Settings) for `GetOwnedGames` to return data.
   > Your **friends list** privacy also needs to be Public separately for the "Friends
   > Playing Now" dashboard panel to show anything.

3. The SQLite database and schema are already migrated (`prisma/dev.db`). If you ever
   change `prisma/schema.prisma`, apply it with:

   ```bash
   npx prisma migrate dev
   ```

4. Run it — either in a browser or as a desktop window:

   ```bash
   npm run dev       # browser: open http://localhost:3000
   npm run desktop   # desktop app: opens its own window, no browser needed
   ```

   `npm run desktop` launches an Electron window that runs the same app internally —
   it starts the Next.js dev server for you, waits for it to be ready, then opens a
   native window (taskbar icon, no browser address bar). Closing the window stops the
   server too.

   Either way: **sign up** with an email + password on the landing page, then go to
   **Connections** and click **Connect Steam** to log in through Steam's OpenID page.
   You'll be redirected back and your library will sync automatically.

## Project structure

- `src/app/page.tsx` — public landing page with the email/password sign in / sign up form
- `src/app/(app)/` — authenticated shell (Navbar + Sidebar + persistent music player)
  wrapping:
  - `dashboard/` — stats (animated count-up), platform breakdown chart, recently played
  - `library/` — searchable/filterable unified game grid, animated stagger entrance
  - `library/[id]/` — game detail page (playtime, last played, Steam achievements, Play button)
  - `connect/` — link/manage platform accounts (Steam now, Epic later)
  - `playlist/` — shared playlist; upload controls only render for `ADMIN_EMAIL`
  - `friends/` — add friends by code, see presence, jump to chat/call
  - `chat/[code]/` — 1:1 text chat with one friend
  - `moderation/` — admin-only (`ADMIN_EMAIL`): warn/mute/timeout/ban by friend code
- `src/app/api/auth/` — `register`/`login`/`logout` (Game Hub account) and
  `steam`/`steam/callback` (platform connection, requires an existing session)
- `src/app/api/playlist/` — upload (`POST`, admin-only), list (`GET`, any signed-in user),
  delete (admin-only), and stream (`[id]/file`, with HTTP Range support for seeking)
- `src/app/api/friends/`, `src/app/api/chat/[code]/`, `src/app/api/moderation/` — the
  local-SQLite side of friends/chat/moderation (Firebase only carries the live signal;
  these routes persist the result)
- `src/lib/` — Steam API client, Prisma client, session helper, password hashing, admin
  check, UI sound synthesis, upload path helpers, shared query logic
- `src/lib/firebase.ts`, `friendRealtime.ts`, `presence.ts`, `chatRealtime.ts`,
  `moderationRealtime.ts`, `webrtc.ts` — the Firebase Realtime Database relay layer:
  friend requests/accepts, online presence, chat delivery, moderation state/warnings, and
  WebRTC call signaling (offer/answer/ICE), respectively. All are no-ops if
  `NEXT_PUBLIC_FIREBASE_*` isn't set.
- `src/context/` — `ThemeContext`, `SoundContext`, `MusicPlayerContext`, `CallContext`
  (React Context providers for cross-page persistent state; `CallContext` owns the
  `RTCPeerConnection` lifecycle for voice calls)
- `prisma/schema.prisma` — `User` (email/passwordHash, points/cosmetics, friendCode),
  `Account` (platform links), `Game`, `OwnedGame` (playtime, rating/notes, installed,
  tags/backlog, unlocked achievements), `PlaytimeSnapshot` (one row per sync, powers the
  playtime trend chart), `Track` (shared playlist audio, app-wide — not tied to a user),
  `Friend`, `ChatMessage`, `ModerationAction` (local, persistent records for the
  friends/chat/moderation feature set)
- `electron/main.js` — desktop window wrapper (spawns the dev server, opens a native window)
- `uploads/music/` — on-disk storage for uploaded playlist tracks (gitignored, served only
  through the authenticated `/api/playlist/[id]/file` route)

## Building a distributable .exe

The desktop app can be packaged into a real installer (`Game Hub Setup.exe`) that runs
without Node, npm, or a terminal — someone just double-clicks it. The pipeline is fully
built and wired up:

```bash
npm run dist
```

This runs, in order:

1. `npm run build:standalone` — production Next.js build (`output: "standalone"`), then
   copies `public/`, `.next/static`, and `.env` into `.next/standalone` (Next's standalone
   output doesn't include these by default).
2. `npm run rebuild:native` — recompiles `better-sqlite3`'s native addon for Electron's
   Node ABI (it's a compiled binary, not portable JS, so it needs rebuilding for Electron's
   bundled Node version).
3. `electron-builder --win` — bundles the standalone server, `dev.db`, and
   `uploads/music/` into an NSIS installer under `release/`.

**Prerequisite for step 2:** compiling `better-sqlite3` on Windows requires a C++ compiler
toolchain — specifically **Visual Studio Build Tools** with the "Desktop development with
C++" workload (or a full Visual Studio install with that workload). Node-gyp will fail with
`Could not find any Visual Studio installation to use` without it. This wasn't installed
automatically since it's a large, invasive system-level change — install it yourself from
[visualstudio.microsoft.com/downloads](https://visualstudio.microsoft.com/downloads/)
(the free "Build Tools for Visual Studio" download is enough, just check "Desktop
development with C++" during install), then run `npm run dist`.

Everything else (icon, tray/autostart, `ELECTRON_RUN_AS_NODE` handling for the packaged
server process, the electron-builder config in `package.json`) is already in place and
verified — `npm run dist` should complete end-to-end once the Build Tools are installed.

## Phase 2 ideas (not implemented yet)

- Additional platforms: GOG, Xbox, PlayStation
- Cross-platform achievement tracking beyond Steam
- Price tracking & wishlist aggregation
- Revisit Epic Games integration if/when a viable API path exists
- Command palette / keyboard shortcuts for power-user navigation
- Library export (CSV/JSON) and cross-friend library comparison
