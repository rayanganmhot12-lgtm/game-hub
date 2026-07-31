# Server channels, categories, and per-server nickname

## Goal

Extend Game Hub's "servers" (upgraded Groups) with real multiple text channels
grouped into collapsible categories, plus a per-server nickname override.
Server Settings becomes a wider modal with a left-nav (Server Profile /
Channels) instead of a single flat form.

## Explicitly out of scope

Server Boost, Create Event, App Directory, Roles, Privacy Settings, AutoMod,
Safety Setup, Audit Log, Bans, Enable Community, Server Template,
Emoji/Stickers/Soundboard, channel/category renaming. These either need
subsystems Game Hub doesn't have (payments, events, bot marketplace) or are
deliberately deferred to control scope.

## Data model

Channels and categories live **only in Firebase** — no new Prisma tables —
consistent with the existing live-only pattern already used for the server's
name, icon, banner/description/traits, and mute flag.

```
groupChats/{groupId}/
  categories/{categoryId}: { name, position }
  channels/{channelId}:    { name, type: "text" | "voice", categoryId: string | null, position }
  roster/{code}:           { displayName, badge, joinedAt, nickname? }   // nickname is new
  ...(existing: name, icon, profile, muted, createdAt, messages, pinned)
```

The only local (SQLite/Prisma) change is one new nullable column:
`GroupMessage.channelId String?`, added via the established raw-SQL
`ALTER TABLE` + `prisma generate` + dev-server-restart process (never
`prisma migrate dev`).

**Backward compatibility:** a server with no `channels` node yet is treated
as having exactly one implicit text channel (`general`) and one implicit
voice channel (`General`) — matching today's behavior. The first time
someone adds a second channel via Channel management, these two defaults are
written to Firebase alongside the new one. Existing messages with
`channelId = null` are displayed under `general`.

## Channels sidebar (GroupChannelsSidebar)

Replaces the current fixed "chat" / "General" rows with a live tree read from
`channels` + `categories`:
- Categories render as collapsible headers (open/closed is local UI state,
  not synced between members).
- Channels with no category sit at the top, uncategorized.
- Clicking a text channel sets the active channel in the parent
  (`GroupChatWindow`); the active channel is highlighted.
- Clicking a voice channel joins the one shared call room for the whole
  server (see below) — all voice channel rows are just labeled entry points
  into the same room, not separate rooms.
- Channel/category creation and deletion happen only from Server Settings →
  Channels (not inline in the sidebar), to keep the sidebar itself simple.

## Server Settings modal

Gains a left-nav with two sections:
- **Server Profile** — unchanged (name, icon, banner, traits, description,
  live preview card).
- **Channels** (new) — list of categories with their channels nested
  underneath, "+ Add Category" and "+ Add Channel" (channel creation lets you
  pick a category or none). Deleting a category moves its channels to
  "Uncategorized" rather than deleting them. Deleting a channel removes it
  from Firebase; that channel's old messages remain in the local SQLite
  mirror but are no longer reachable, matching Discord's own behavior.

## Voice channels

Confirmed: no separate call rooms per channel. All voice channel entries
join the existing single `GroupCallContext` room keyed by `groupId`. This
avoids reworking the WebRTC signaling code, which stays untouched.

## Messages

- `sendGroupMessage` / `GroupMessagePayload` gain a `channelId` field.
- `POST /api/groups/[groupId]/messages` accepts and stores `channelId`.
- `GroupChatWindow` fetches all of the group's messages once (as today) and
  filters client-side by the active channel — simplest option at this app's
  personal-use scale, avoids a refetch-per-channel-switch round trip.
- The full "Welcome to <server>" onboarding checklist still only shows when
  the whole server is brand new (0 extra members, 0 messages anywhere),
  scoped to the `general` channel. Any other empty channel just shows
  "This is the start of #<channel-name>."

## Per-server nickname

- New dropdown item **"Nickname"** (separate from "Server Settings", since
  it's a personal setting, not a shared server setting) opens a small modal:
  one input, Save.
- Stored as `roster/{myCode}.nickname` in Firebase — 100% live, no Prisma
  involvement.
- Wherever a member's name is rendered live (member list, chat message
  sender label), prefer `nickname ?? displayName`. The underlying
  `senderDisplayName` baked into stored `GroupMessage` rows is left alone —
  it stays the historical record; only live rendering applies the override,
  looked up from the same in-memory roster map `GroupChatWindow` already
  maintains for the member list.

**Ordering:** `position` is set to "append at the end" when a category or
channel is created (no drag-to-reorder UI in this pass — out of scope, same
as renaming).

## Migration steps (execution order)

1. Raw-SQL `ALTER TABLE GroupMessage ADD COLUMN channelId TEXT` +
   `npx prisma generate` + restart the dev server.
2. `groupRealtime.ts`: add channel/category CRUD + listeners, roster
   `nickname` field, `sendGroupMessage`/`GroupMessagePayload` gain
   `channelId`.
3. `GroupChannelsSidebar.tsx`: rewrite to render the live channel tree;
   lift `activeChannelId` state up to `GroupChatWindow`.
4. `GroupChatWindow.tsx`: filter messages by active channel, tag sends with
   it, apply nickname override to sender labels, scope the welcome screen
   per-channel.
5. `GroupMembersList.tsx`: apply nickname override to member rows.
6. Settings modal: add left-nav, build the new Channels management tab.
7. New "Nickname" dropdown item + small modal.
8. `/api/groups/[groupId]/messages`: accept/store `channelId`.
9. Verify end-to-end with disposable test accounts (create categories,
   channels, switch between them, send messages in each, set a nickname,
   delete a channel/category), clean up test data, `tsc`/`eslint`.
