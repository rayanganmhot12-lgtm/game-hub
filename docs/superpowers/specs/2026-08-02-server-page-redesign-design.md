# Server Page Redesign — Design Spec

Date: 2026-08-02

## Goal

Refresh the visual feel of Game Hub's server/community page (`/groups/[groupId]` and its
supporting components) without changing any underlying data model, Firebase relay
behavior, or feature set. The main pain point called out: messages and channels
look dated and repetitive, and the page as a whole needs a visual pass. This is a
frontend-only redesign — no schema, API, or Firebase-shape changes.

## Current State

- **Messages** (`src/components/GroupChatWindow.tsx`, message list ~L771-926): every
  message renders as its own bubble row with its own avatar, sender name, and
  badge/tag/role chips — even for consecutive messages from the same person. Own
  messages are right-aligned (`flex-row-reverse`) in a WhatsApp/iMessage-style bubble
  layout; others are left-aligned. This causes heavy repetition in active chats and
  doesn't match the "mix of Discord + Game Hub identity" direction chosen for this
  redesign.
- **Channels sidebar** (`src/components/GroupChannelsSidebar.tsx`, main render
  ~L316-463): fixed `w-60` column with a banner-colored header dropdown (Invite
  People / Server Settings / Nickname / Mute / Leave / Delete), collapsible
  categories, and channel rows. Active-channel and hover states exist but are subtle;
  "+ Add Channel" / "+ Add Category" links are always visible rather than
  appearing on hover.
- **Member list** (`src/components/GroupMembersList.tsx`): already groups online
  members by hoisted role (role name as a colored section header, same pattern as
  Discord), with a separate "Online" bucket for no-role members and one "Offline"
  bucket. Member row avatars, presence dots, and role crest already exist. The
  member's own display-name text is always `text-foreground` regardless of role
  color.
- **ServerRail** (`src/components/ServerRail.tsx`): vertical icon rail, circle→
  rounded-square shape shift on hover/active, no easing/scale motion beyond the
  shape transition.
- All of these already share the app's design tokens (`panel`, `btn-primary`,
  `btn-ghost`, `input-field`, `bg-surface`/`bg-surface-2`, `accent`/`accent-bright`,
  `text-muted`/`text-foreground`) — this redesign keeps using those tokens rather
  than introducing new ones.

## Direction

A mix of Discord's message/channel UX patterns (grouped messages, hover-reveal
actions, clearer active states) with Game Hub's own visual identity (existing
accent-color system, panel/surface tokens, existing Theme Editor colors) — not a
literal Discord skin.

## Scope

The full server page: message list, channels sidebar, member list, and the
ServerRail icon rail. The single largest structural change is message grouping;
everything else is a visual/interaction polish pass over the existing structure
and data flow — no new features, no new database columns, no new Firebase paths.

## 1. Message Grouping (structural change)

Replace the current one-row-per-message bubble layout with Discord-style grouped
messages, computed in `GroupChatWindow.tsx` from the existing `searchedMessages`
array (no change to how messages are fetched or stored):

- **Grouping rule:** consecutive messages belong to the same group when they have
  the same `senderCode` AND the gap between one message's `sentAt` and the previous
  message's `sentAt` is 5 minutes or less. A different sender, or a gap over 5
  minutes, starts a new group.
- **Layout:** single column, everyone left-aligned — remove the `isMine` right-
  alignment (`flex-row-reverse`) entirely. Whether a message is yours is no longer
  shown via alignment; it's implied by which messages expose edit/delete controls.
- **Group header row** (first message in a group only): avatar (32px, up from the
  current 26px) + sender name + badge/tag/role chips (unchanged data source) + a
  timestamp shown next to the name, always visible.
- **Subsequent rows in the same group:** message text only, indented to align under
  where the header's name starts (no repeated avatar/name/badges). On hover, a
  small muted timestamp appears in the space the avatar would occupy, plus the
  existing edit/delete/pin icon row (already implemented via
  `opacity-0 transition-opacity group-hover/msg:opacity-100`) — that hover wrapper
  moves from being keyed on `isMine` alone to wrapping every message row, since the
  icons it reveals already gate on `isMine`/permissions internally.
- **Search interaction:** when `searchQuery` is non-empty, grouping is bypassed —
  render `searchedMessages` as flat, ungrouped rows (each with its own avatar/name/
  timestamp), since matched results are often non-consecutive and grouping them
  would misrepresent who said what. This only changes the message list's rendering
  path when a search is active; `searchedMessages`'s existing filtering logic is
  unchanged.
- **Unaffected logic:** editing (`startEdit`/`isEditing`/`editDraft`), deleting
  (`handleDeleteMessage`), pinning (`isPinned`/`scrollToMessage`), the
  `id={msg-${clientId}}` anchor used for pin-jump, mention highlighting, image
  attachment rendering, and the member-profile/context-menu click targets on the
  sender name/avatar all keep their current behavior — only which row currently
  renders the avatar/name/timestamp changes.

## 2. Message Visual Style

- Avatar bumps from 26px to 32px, shown once per group (not per message).
- Remove the current bubble background entirely — message text sits directly on
  the existing `bg-surface/20` chat background, matching Discord's flat look.
- Add a subtle per-row hover highlight (a light `hover:bg-surface-2/20`-style
  background on the row currently under the cursor) so it's clear which message
  the hover-revealed action icons belong to.
- Timestamp: always shown next to the name on a group's first row; shown only on
  hover (in the avatar's gutter space) for the group's other rows.
- Badges/tag/role chips: unchanged visually, just rendered once per group instead
  of once per message.

## 3. Channels Sidebar Polish

Visual-only changes to `GroupChannelsSidebar.tsx`'s main render — no change to the
categories/channels data model, collapse state, or add/remove logic:

- Active channel gets a clear left accent-colored bar plus a light accent-tinted
  background fill, instead of relying mainly on text-color difference.
- A clearer hover background for non-active channel rows.
- "+ Add Channel" and "+ Add Category" affordances only render when the user is
  hovering the relevant category section (or the uncategorized section), instead
  of always being visible — reduces visual clutter for categories that already
  have channels.
- Slightly more generous, consistent vertical spacing between rows and category
  groups.

## 4. Member List + ServerRail Polish

- **Member list:** when a member has a role with a color, their display-name text
  in `Row` picks up that role's color (via the existing `tagColorClassName(role.color)`
  helper already used for role section headers and role chips) instead of always
  rendering `text-foreground`. No-role members keep the current plain foreground
  color. No changes to the online/offline/role-grouping logic.
- **ServerRail:** keep the existing circle → rounded-square shape transition on
  hover/active; add a small scale-up on hover (subtle, e.g. slightly larger than
  100%) for a livelier feel, purely a CSS/Framer-Motion-level transition change —
  no change to navigation, active-state detection, or server list data.

## Error Handling

This is a presentational change with no new failure modes to handle: no new
network calls, no new API routes, no new Firebase paths. Existing error handling
(toasts on failed edit/delete/pin/etc.) is unaffected.

## Testing

No automated test framework exists in this project (consistent with the rest of
the codebase). Verification is `npx tsc --noEmit` and `npx eslint .` after each
change, plus a manual pass in the running dev server using the existing "Game Hub"
test server (account KyKy1) covering:

- Sending several consecutive messages from the same account groups them under one
  avatar/name; sending from a different account (or after a 5+ minute gap) starts a
  new group.
- Editing, deleting, and pinning a message that isn't the first row in its group
  still works and targets the correct message.
- Searching messages shows flat, ungrouped results; clearing the search returns to
  grouped rendering.
- Mentions, image attachments, and reactions still render correctly inside the new
  row layout.
- Channel active/hover states, and category hover-reveal add-channel/add-category
  controls, behave correctly, including with categories collapsed.
- A member with a colored role shows their name in that color in the member list;
  a member without a role does not.
- ServerRail hover scale animation doesn't break the existing active-state ring/
  rounding behavior.

Any test data or messages created during manual verification are cleaned up
afterward, consistent with this project's existing testing-safety practice.

## Out of Scope

- Any change to the Firebase data shape, message storage, or the Prisma schema.
- New chat features (reactions types, message threading, voice channel UI, etc.)
  beyond the visual/interaction changes described above.
- The ServerModerationTabs / Server Settings modal's internal tabs (Profile, Tag,
  Channels management, Members, Roles, Bans, AutoMod, Emoji) — those keep their
  current appearance; only the main channel-list sidebar view changes.
- General app-wide motion polish (deferred from an earlier brainstorm round) — this
  spec only covers the server/community page.
