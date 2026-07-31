# Switch Accounts — Design Spec

Date: 2026-07-31

## Goal

Let a user log in as multiple Game Hub accounts on the same device/browser and
instantly switch the active one, matching Discord's "Switch Accounts" popup —
without re-entering a password each time they switch back to an account
they've already logged into.

This was originally dropped as a decorative stub (no multi-account session
infrastructure existed). The user asked for it to actually work, so this spec
adds the minimum real infrastructure needed.

## Out of scope

- A full "Manage Accounts" settings screen (reordering, per-account
  nicknames-for-the-switcher, etc.) — folded into a single "Add Another
  Account" action instead.
- Server-side session storage / a `Session` DB table. Nothing else in this
  app uses server-side sessions; this would be the only feature needing it.
- Per-account cookies. One cookie, extended payload — see below.
- Any change to how `getCurrentUser()` / the rest of the app identifies "the
  current user" — it keeps reading `session.userId` exactly as today.

## Data model

`src/lib/session.ts`'s `SessionData` gains one field:

```ts
export interface SavedAccount {
  userId: string;
  email: string;
  displayName: string;
}

export interface SessionData {
  userId?: string; // unchanged — the ACTIVE account
  savedAccounts?: SavedAccount[]; // other logged-in accounts on this device, most-recent-first
}
```

`savedAccounts` never includes the currently-active `userId` — it's strictly
"everyone else you can switch to instantly." Max length: **5** (matches
Discord's own cap). This is enforced when adding, not when switching.

## Behavior changes

### Normal login (unchanged for the common case)

`POST /api/auth/login` with no `addAccount` flag: fully replaces the session
exactly as today (`userId` set, `savedAccounts` cleared). This is what the
landing-page login form calls — logging in normally from a logged-out state
should not mysteriously carry over some other account's saved list.

### Add Account

`POST /api/auth/login` with `{ ...email, password, addAccount: true }`:

1. Validate credentials as normal.
2. Reject with 400 if the authenticated account is already the active
   `userId` ("You're already using that account.").
3. Reject with 400 if it's already present in `savedAccounts` ("That
   account's already added — switch to it instead.").
4. Reject with 400 if `savedAccounts.length >= 5` ("Remove an account before
   adding another.").
5. Push the **current** `{userId, email, displayName}` onto `savedAccounts`
   (looked up fresh from the DB, not trusted from the old cookie).
6. Set the newly authenticated account as the new active `userId`.

Called from a new small modal opened via "Add Another Account" in the
Switch Accounts submenu — same email/password fields as the existing
`AuthForm`, POSTing with `addAccount: true`.

### Switch

New route `POST /api/auth/switch` with `{ userId }`:

1. 400 if `userId` isn't present in the current session's `savedAccounts`
   (no switching to arbitrary/unauthenticated accounts).
2. Move the current active `userId` (with a fresh DB lookup for
   email/displayName) into `savedAccounts`.
3. Remove the target entry from `savedAccounts` and set it as the new active
   `userId`.
4. No password required — both accounts were already authenticated into this
   same session.

### Log out (top nav button, unchanged endpoint: `POST /api/auth/logout`)

- If `savedAccounts` is empty: destroy the session exactly as today, land on
  the login screen.
- If `savedAccounts` has entries: drop the active account, promote the first
  entry in `savedAccounts` to active, save the session (no destroy) — the
  user lands back in the app already logged in as that other account, no
  password prompt.

## UI

`FriendProfileModal`, self-view only (`isSelf`):

- "Switch Accounts" row (already scaffolded) becomes a real expandable
  submenu, same interaction pattern as the existing Roles/Status submenus:
  avatar + display name per saved account, a checkmark-style highlight on
  the active one (shown as a disabled/non-interactive row since you can't
  switch to yourself), click any other row to call `/api/auth/switch` and
  then `router.refresh()`.
- Bottom of that list: "**Add Another Account**" — opens a small modal
  (reusing the existing modal/panel visual style) with email + password
  fields, submits to `/api/auth/login` with `addAccount: true`, then
  `router.refresh()` on success.
- The saved-accounts list itself needs to be visible to the client to render
  the submenu: extend `GET /api/me` to also read the session directly (not
  just `getCurrentUser()`, which only resolves the DB-backed active user)
  and include `savedAccounts` in its response.

## Security notes

All accounts in `savedAccounts` are exactly as trusted as the active one
today — this is a personal, single-device app, not a shared/public terminal
model, so extending trust from "one already-authenticated cookie" to "up to
5 already-authenticated accounts in that same cookie" doesn't introduce a new
class of risk. Switching still requires the switch target to have been
through a real password check at some point (step 4 of Add Account) — you
can never switch into an account you haven't already authenticated as in
this session.

## Edge cases

- Removing a saved (non-active) account: not building a dedicated "remove"
  action for v1 — switching to it and then logging out removes it (falls
  out naturally from the Log Out behavior above). If this turns out to be
  annoying in practice, a "remove" (x) on each non-active row is a small
  follow-up.
- If the DB lookup for a `userId` in `savedAccounts` fails (account deleted
  since being saved), drop that entry silently rather than erroring the
  whole switch/logout flow.
