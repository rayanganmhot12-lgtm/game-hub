# In-App Steam API Key Setup — Design Spec

Date: 2026-08-01

## Goal

Let any Game Hub user paste their own Steam Web API key directly into the app, so Steam sync works for them without ever touching a `.env` file or running a PowerShell command. This is a prerequisite for future features that depend on Steam data being reliably available for every friend, not just the developer's own installs (e.g., a planned "Now Playing" live status feature, deferred until after this).

## Current State

- `STEAM_API_KEY` is a single, install-wide value read via `process.env.STEAM_API_KEY` in five places in `src/lib/steam.ts`, each with its own `if (!apiKey) throw new Error("STEAM_API_KEY is not configured")` check.
- In development, it comes from the project's `.env` file (or a session/user-level environment variable set via PowerShell).
- In packaged builds, `scripts/prepare-standalone.js` deliberately strips `STEAM_API_KEY` from the bundled `.env` before packaging — this key is the developer's own personal, rate-limited Steam credential, and shipping it in every install would let any friend extract and reuse it.
- Today, a friend who wants Steam sync to work has to manually open their install's `resources/standalone/.env` file in a text editor and add the line themselves — or set a system environment variable via PowerShell — then restart the app. This requires knowing the install's file layout and being comfortable editing a config file, which most friends won't be.
- Steam OpenID login (the actual "Connect Steam" account-linking step on `/connect`) needs no API key at all — only the sync calls (`GetOwnedGames`, `GetPlayerSummaries`) do. So a friend can already link their Steam account today; only the subsequent sync silently fails with "STEAM_API_KEY is not configured" until a key is added.
- Steam itself has no programmatic way to mint a Web API key — a person must be logged into steamcommunity.com in a browser, visit `steamcommunity.com/dev/apikey`, and copy the key by hand. There is no OAuth-style flow this app can drive on their behalf. What this feature *can* remove is everything after that: no `.env`, no PowerShell, no file paths — just paste the key into a field in the app.

## UI

On the Connections page (`/connect`), add a new panel below the existing Steam/Epic connection rows:

- A short label ("Steam API Key") and one line of explanation: this key is what lets your library sync — get your own free key from Steam, then paste it here.
- A direct link to `https://steamcommunity.com/dev/apikey` (opens in the system's default browser, not inside the app, since it requires the user's own logged-in Steam session).
- A single password-style text input (masked, since it's a credential) plus a "Save" button, matching the existing `input-field`/`btn-primary` styling used elsewhere in this app (e.g., the Username field on `/profile`).
- If a key is already saved for this install, the input shows a masked placeholder (a fixed cosmetic run of 8 `•` characters, not reflecting the real key's length since the server never sends that back, followed by the real last 4 characters, e.g. `••••••••1234`) instead of the raw value, and the button reads "Update" instead of "Save" — never round-trip the full existing key back to the browser.
- After a successful save, show a toast: "Saved — close and reopen Game Hub for it to take effect." No in-app auto-restart; the design spec explicitly rules this out as unnecessary complexity for a personal app where the user already knows how to close and reopen it.
- If the save request fails (e.g., empty input, or writing the settings file fails), show an error toast with the reason; do not silently no-op.

## Where the Key Is Stored

This key belongs to the *installation*, not to a specific logged-in local account (the same Steam key is used regardless of which of the install's saved accounts is currently active) — the same reasoning already applied to `SESSION_SECRET` in `electron/main.js`'s `getOrCreateSessionSecret()`. It must **not** live in the Prisma `User` table.

- New file: `settings.json`, alongside the existing `secrets.json`, in the same directory (`GAMEHUB_DATA_DIR`, i.e. Electron's `userData` folder for packaged installs — already passed to the Next.js server process as an environment variable by `electron/main.js`).
- Shape: `{ "steamApiKey": "<string>" }` — a flat JSON object, extensible later if more install-level settings are ever needed.
- In local development (`npm run dev`, no Electron, no `GAMEHUB_DATA_DIR`), this file is written to `path.join(process.cwd(), "settings.json")` (the project root) instead, and must be added to `.gitignore` — but the intended way to set a key in dev remains the existing `.env`/PowerShell approach, which continues to take priority (see below), since that's the workflow already used for local testing.

## How `steam.ts` Resolves the Key

Replace the five duplicated `const apiKey = process.env.STEAM_API_KEY; if (!apiKey) throw ...` blocks with one shared helper:

```ts
function getSteamApiKey(): string {
  if (process.env.STEAM_API_KEY) return process.env.STEAM_API_KEY;
  const settings = readInstallSettings();
  if (settings.steamApiKey) return settings.steamApiKey;
  throw new Error("STEAM_API_KEY is not configured");
}
```

`process.env.STEAM_API_KEY` is checked first so an active local-dev `.env`/environment-variable value always wins (unchanged workflow for development). `readInstallSettings()` reads and parses `settings.json` from `GAMEHUB_DATA_DIR` (or the dev-mode fallback path), returning `{}` if the file doesn't exist yet or fails to parse — never throwing on a missing settings file, only on a genuinely missing key at the end.

## New API Route

`POST /api/settings/steam-api-key` — accepts `{ apiKey: string }` from any authenticated user (not admin-gated; this is a per-install convenience setting any friend using that install should be able to set for themselves), validates it's a non-empty string, writes it into `settings.json` (merging with whatever else may already be in that file, never overwriting unrelated keys), and returns `{ ok: true }`. A `GET` on the same route returns whether a key is currently set and, if so, its last 4 characters only — enough for the UI's masked-placeholder display, never the full value.

## Error Handling

- Empty/whitespace-only submitted key: reject with a 400 and a clear message, no write attempted.
- Settings file write failure (e.g., disk permission issue): return a 500 with a generic error message; the toast tells the user to try again.
- `readInstallSettings()` must never crash a Steam API call just because the settings file is missing or malformed — treat both as "no key set yet" and fall through to the existing "STEAM_API_KEY is not configured" error path, which every sync call site already handles today.

## Testing

No automated test framework exists in this project. Verification is `npx tsc --noEmit` / `npx eslint` plus a real manual check: paste a real (or intentionally invalid, to check the error path) Steam API key into the field on a running dev-mode instance where `GAMEHUB_DATA_DIR` is simulated or the dev fallback path is used, confirm `settings.json` is written correctly, confirm the masked placeholder appears on reload, and confirm a subsequent Steam sync attempt succeeds using the saved key (with `process.env.STEAM_API_KEY` unset for that check, to prove the fallback path — not just the dev environment variable — is what's actually being exercised).

## Out of Scope

- Automating Steam's own key-issuance page in any way (not possible without Steam providing an OAuth-style flow, which it doesn't).
- Auto-restarting the app after a key is saved.
- The "Now Playing" live status feature itself — this spec only unblocks it for friends without a technical setup step; that feature gets its own design pass afterward.
