# Server Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the visual feel of Game Hub's server/community page — grouped Discord-style messages, a clearer channels sidebar, role-colored member names, and a livelier ServerRail — with no changes to the database, API routes, or Firebase data shapes.

**Architecture:** Four independent frontend components each get a focused visual/interaction pass. `GroupChatWindow.tsx` gets the only structural change (grouping consecutive messages from the same sender); `GroupChannelsSidebar.tsx`, `GroupMembersList.tsx`, and `ServerRail.tsx` get className-level polish over their existing render logic and data flow.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Framer Motion, lucide-react icons.

## Global Constraints

- Frontend-only: no changes to `prisma/schema.prisma`, any `src/app/api/**` route, or any Firebase path/shape in `src/lib/*Realtime.ts`.
- Message grouping window: consecutive messages from the same `senderCode` merge into one group when the gap between them is 5 minutes (300000ms) or less; a different sender or a larger gap starts a new group.
- Group avatar size: 32px (`h-8 w-8` / `size={32}`), up from the current 26px.
- No automated test framework exists in this project — verification per task is `npx tsc --noEmit` and `npx eslint .`, plus a manual check in the running dev server.
- Manual verification uses the existing "Game Hub" server (`groupId` `J2DCG3EB`) and the `KyKy1` dev account already logged in in this environment; any messages/test data created during verification are cleaned up afterward (delete via the existing message-delete action), consistent with this project's testing-safety practice.
- Reuse existing design tokens only (`bg-surface`, `bg-surface-2`, `accent`/`accent-bright`, `text-muted`/`text-foreground`, `border-border`) — no new CSS variables or Tailwind theme entries.

---

### Task 1: Message grouping and visual restyle

**Files:**
- Modify: `src/components/GroupChatWindow.tsx:70` (add a grouping helper near the top, after `escapeRegExp`)
- Modify: `src/components/GroupChatWindow.tsx:608-620` (add `isSearching`/`messageGroups` derived values next to the existing `searchedMessages`)
- Modify: `src/components/GroupChatWindow.tsx:771-951` (replace the message-rendering JSX inside the `searchedMessages.length === 0 ? ... : (...)` block's `else` branch)

**Interfaces:**
- Consumes: nothing from other tasks in this plan (self-contained).
- Produces: nothing consumed by later tasks — Tasks 2-4 touch different files.

- [ ] **Step 1: Add the `MessageGroup` type and `buildGroups` helper**

Add this directly after the `escapeRegExp` function (currently ending at line 56 of `src/components/GroupChatWindow.tsx`), before `extractMentions`:

```tsx
const GROUP_WINDOW_MS = 5 * 60 * 1000;

interface MessageGroup {
  senderCode: string;
  messages: GroupMessage[];
}

// Consecutive messages from the same sender, no more than 5 minutes apart,
// render under one avatar/name header instead of repeating it per message —
// bypassed entirely while searching (see isSearching below), since matched
// results are usually non-consecutive and grouping them would misrepresent
// who said what.
function buildGroups(msgs: GroupMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const m of msgs) {
    const last = groups[groups.length - 1];
    const lastMsg = last?.messages[last.messages.length - 1];
    const sameSender = last?.senderCode === m.senderCode;
    const withinWindow =
      lastMsg !== undefined && new Date(m.sentAt).getTime() - new Date(lastMsg.sentAt).getTime() <= GROUP_WINDOW_MS;
    if (sameSender && withinWindow) {
      last.messages.push(m);
    } else {
      groups.push({ senderCode: m.senderCode, messages: [m] });
    }
  }
  return groups;
}

function formatMessageTime(sentAt: string | Date): string {
  return new Date(sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
```

This references `GroupMessage`, which is declared later in the same file (line 195) — TypeScript/Next.js function declarations and interfaces in a module are hoisted for type-checking purposes within the same file scope, so this compiles fine placed before the interface. If `npx tsc` disagrees, move `interface GroupMessage { ... }` (currently lines 195-204) to just above this new code instead — but do not duplicate it.

- [ ] **Step 2: Verify it compiles so far**

Run: `npx tsc --noEmit`
Expected: no new errors (the file won't build correctly yet since nothing uses `buildGroups`/`formatMessageTime` — that's fine, unused-function warnings don't fail this command; if ESLint flags them as unused, that resolves once Step 3 uses them).

- [ ] **Step 3: Compute `isSearching` and `messageGroups`**

Immediately after the existing `displayChannels`/`activeChannelName` lines (currently lines 619-620 of `src/components/GroupChatWindow.tsx`), add:

```tsx
  const isSearching = searchQuery.trim().length > 0;
  const messageGroups: MessageGroup[] = isSearching
    ? searchedMessages.map((m) => ({ senderCode: m.senderCode, messages: [m] }))
    : buildGroups(searchedMessages);
```

- [ ] **Step 4: Replace the message-list rendering JSX**

Find this block (currently lines 771-951 of `src/components/GroupChatWindow.tsx` — the `else` branch of the `searchedMessages.length === 0 ? ... : (...)` ternary that starts with `<div className="flex flex-col gap-2">` and ends just before the closing `)}` of that ternary):

```tsx
            <div className="flex flex-col gap-2">
              {searchedMessages.map((m) => {
                const isMine = m.senderCode === myCode;
                /* ...full original block through the closing MessageReactions and outer </div> at line 951... */
              })}
              <div ref={bottomRef} />
            </div>
```

Replace the entire thing with:

```tsx
            <div className="flex flex-col gap-3">
              {messageGroups.map((group) => {
                const first = group.messages[0];
                const isMineGroup = group.senderCode === myCode;
                const senderName = isMineGroup
                  ? nicknames[myCode] ?? myDisplayName
                  : nicknames[group.senderCode] ?? first.senderDisplayName;
                const senderBadge = isMineGroup
                  ? myBadge
                  : members.find((mem) => mem.memberCode === group.senderCode)?.memberBadge;
                const senderRoleId = memberRoles[group.senderCode];
                const senderRole = senderRoleId ? roles.find((r) => r.id === senderRoleId) : undefined;
                const senderAvatarUrl = isMineGroup ? myAvatarDataUrl : profiles[group.senderCode]?.avatarDataUrl;

                function openProfile() {
                  setViewingMember({
                    code: group.senderCode,
                    displayName: senderName,
                    badge: senderBadge,
                    roleId: senderRoleId ?? null,
                  });
                }
                function openContextMenu(e: React.MouseEvent) {
                  e.preventDefault();
                  setMsgMenuTarget({
                    member: {
                      code: group.senderCode,
                      displayName: senderName,
                      badge: senderBadge,
                      tagEquipped: tagEquippedCodes.has(group.senderCode),
                      roleId: senderRoleId ?? null,
                    },
                    x: e.clientX,
                    y: e.clientY,
                  });
                }

                return (
                  <div key={first.id} className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 px-1">
                      <button onClick={openProfile} onContextMenu={openContextMenu} title="View profile" className="shrink-0">
                        {senderAvatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                          <img
                            src={senderAvatarUrl}
                            alt={senderName}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-full object-cover"
                          />
                        ) : (
                          <Avatar name={senderName} size={32} />
                        )}
                      </button>
                      <button
                        onClick={openProfile}
                        onContextMenu={openContextMenu}
                        className="flex items-center gap-1.5 text-left transition-colors hover:text-foreground"
                      >
                        <span className="text-sm font-medium text-foreground">{senderName}</span>
                        <CosmeticBadge badgeId={senderBadge} />
                        {tag && tagEquippedCodes.has(group.senderCode) && <TagChip tag={tag} />}
                        {senderRole && <RoleChip role={senderRole} />}
                      </button>
                      <span className="text-[11px] text-muted">{formatMessageTime(first.sentAt)}</span>
                    </div>

                    <div className="flex flex-col">
                      {group.messages.map((m) => {
                        const isPinned = !!m.clientId && m.clientId === pinnedClientId;
                        const isEditing = !!m.clientId && editingClientId === m.clientId;
                        const editedText = m.clientId ? edits[m.clientId] : undefined;
                        const displayText = editedText ?? m.text;
                        return (
                          <div
                            key={m.id}
                            id={m.clientId ? `msg-${m.clientId}` : undefined}
                            className={`group/msg flex items-start gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-surface-2/20 ${
                              isPinned ? "ring-1 ring-accent-bright/40" : ""
                            }`}
                          >
                            <span className="flex w-8 shrink-0 items-center justify-center pt-0.5 text-[10px] text-muted opacity-0 transition-opacity group-hover/msg:opacity-100">
                              {formatMessageTime(m.sentAt)}
                            </span>
                            <div className="min-w-0 flex-1">
                              {isEditing ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    autoFocus
                                    value={editDraft}
                                    onChange={(e) => setEditDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") saveEdit();
                                      if (e.key === "Escape") cancelEdit();
                                    }}
                                    className="input-field !py-1 !text-sm"
                                  />
                                  <button onClick={saveEdit} className="rounded-full p-1 text-emerald-400 hover:bg-surface-2" title="Save">
                                    <Check size={14} />
                                  </button>
                                  <button onClick={cancelEdit} className="rounded-full p-1 text-muted hover:bg-surface-2" title="Cancel">
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1 text-sm text-foreground">
                                  {m.imageDataUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                                    <img
                                      src={m.imageDataUrl}
                                      alt="Attachment"
                                      className="max-h-64 max-w-full rounded-lg object-contain"
                                    />
                                  )}
                                  {displayText && (
                                    <span>
                                      {renderMessageContent(displayText, emoji, allMembers, displayChannels, setActiveChannelId)}
                                      {editedText !== undefined && <span className="ml-1 text-[10px] opacity-60">(edited)</span>}
                                    </span>
                                  )}
                                </div>
                              )}
                              {m.clientId && (
                                <MessageReactions
                                  reactions={reactions[m.clientId]}
                                  myCode={myCode}
                                  align="start"
                                  onToggle={(emojiName) => toggleReaction(reactionsPath, m.clientId!, emojiName, myCode)}
                                />
                              )}
                            </div>
                            {!isEditing && m.clientId && (
                              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
                                {isMineGroup && (
                                  <>
                                    <button
                                      onClick={() => startEdit(m)}
                                      className="rounded-full p-1 text-muted hover:text-foreground"
                                      title="Edit"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMessage(m.clientId!)}
                                      className="rounded-full p-1 text-muted hover:text-red-400"
                                      title="Delete"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setPinnedMessage(groupId, isPinned ? null : m.clientId!)}
                                  className="rounded-full p-1 text-muted hover:text-foreground"
                                  title={isPinned ? "Unpin" : "Pin message"}
                                >
                                  {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
```

Notes for whoever implements this:
- `toggleReaction`'s callback parameter is renamed from `emoji` to `emojiName` only to avoid shadowing the outer `emoji` state array (`const [emoji, setEmoji] = useState<...>([])`) that `renderMessageContent(...)` also uses a few lines above — the original code had this same shadow but never used the outer `emoji` inside that particular callback, so the rename is required now that both live in the same nested scope as `renderMessageContent`'s call. Behavior is unchanged.
- Both the avatar button and the name button call the same `openProfile`/`openContextMenu` closures — this mirrors the original code's duplicated inline handlers on the avatar and name separately, just de-duplicated since both now need the exact same "my vs. their" branching.
- Pinning is available on every message regardless of sender (matches the original: `isMine` messages could pin via the same hover group, `!isMine` messages had a separate pin-only button) — only edit/delete stay gated on `isMineGroup`.

- [ ] **Step 5: Run the verification commands**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors (an unused-`isMine`-style warning would indicate leftover dead code from the old block — there should be none, since the whole ternary branch was replaced).

- [ ] **Step 6: Manual check in the browser**

Using the running dev server, the `KyKy1` account, and the existing "Game Hub" test server (`/groups/J2DCG3EB`):
- Send 2-3 messages in a row — confirm they render under a single avatar/name/timestamp header, with only text (and a hover-reveal timestamp) below.
- Have the conversation include a message from a different sender (or wait 5+ minutes) — confirm a new group starts.
- Edit one of your own non-first messages in a group — confirm the input replaces just that line and saving keeps the group intact.
- Delete a message in the middle of a group — confirm the rest of the group still renders correctly.
- Pin a message that isn't the first in its group, then click the pinned banner — confirm it scrolls to and highlights the right message.
- Type something in the search box — confirm results show flat (each with its own avatar/name/timestamp), and clearing the search restores grouped view.
- Send a message containing an `@mention`, a `#channel` reference, and a custom emoji shortcode — confirm all three still render correctly.
- Attach an image to a message — confirm it still renders inline.
- Delete any messages sent purely for this verification afterward.

- [ ] **Step 7: Commit**

```bash
git add src/components/GroupChatWindow.tsx
git commit -m "Group consecutive chat messages Discord-style, remove message bubbles"
```

---

### Task 2: Channels sidebar visual polish

**Files:**
- Modify: `src/components/GroupChannelsSidebar.tsx:300-313` (the text-channel branch of `renderChannelRow`)
- Modify: `src/components/GroupChannelsSidebar.tsx:394-416` (category list spacing in the main sidebar render)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Give the active/hover channel row states clearer treatment**

Find this block (currently lines 300-313 of `src/components/GroupChannelsSidebar.tsx`):

```tsx
    const unread = !active && !!unreadChannelIds?.has(channel.id);
    return (
      <button
        key={channel.id}
        onClick={() => onSelectChannel(channel.id)}
        className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors ${
          active ? "bg-surface-2/60 text-foreground" : "text-muted hover:bg-surface-2/30 hover:text-foreground"
        }`}
      >
        <Hash size={16} className="shrink-0" />
        <span className={`truncate ${unread ? "text-foreground" : ""}`}>{channel.name}</span>
        {unread && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright" />}
      </button>
    );
```

Replace it with:

```tsx
    const unread = !active && !!unreadChannelIds?.has(channel.id);
    return (
      <button
        key={channel.id}
        onClick={() => onSelectChannel(channel.id)}
        className={`relative flex w-full items-center gap-1.5 rounded-lg py-1.5 pl-3 pr-2 text-left text-sm font-medium transition-colors ${
          active ? "bg-accent/10 text-foreground" : "text-muted hover:bg-surface-2/40 hover:text-foreground"
        }`}
      >
        {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-full bg-accent-bright" />}
        <Hash size={16} className="shrink-0" />
        <span className={`truncate ${unread ? "text-foreground" : ""}`}>{channel.name}</span>
        {unread && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-accent-bright" />}
      </button>
    );
```

- [ ] **Step 2: Loosen the vertical rhythm between categories**

Find this block (currently lines 394-416 of `src/components/GroupChannelsSidebar.tsx`):

```tsx
      <div className="flex-1 overflow-y-auto p-2">
        {uncategorized.length > 0 && (
          <div className="mb-2 flex flex-col gap-0.5">{uncategorized.map(renderChannelRow)}</div>
        )}

        {sortedCategories.map((cat) => {
          const isCollapsed = collapsed.has(cat.id);
          const catChannels = displayChannels.filter((c) => c.categoryId === cat.id).sort((a, b) => a.position - b.position);
          return (
            <div key={cat.id} className="mb-2">
              <button
                onClick={() => toggleCollapsed(cat.id)}
                className="flex w-full items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted hover:text-foreground"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {cat.name}
              </button>
              {!isCollapsed && <div className="flex flex-col gap-0.5">{catChannels.map(renderChannelRow)}</div>}
            </div>
          );
        })}

      </div>
```

Replace it with:

```tsx
      <div className="flex-1 overflow-y-auto p-2">
        {uncategorized.length > 0 && (
          <div className="mb-3 flex flex-col gap-1">{uncategorized.map(renderChannelRow)}</div>
        )}

        {sortedCategories.map((cat) => {
          const isCollapsed = collapsed.has(cat.id);
          const catChannels = displayChannels.filter((c) => c.categoryId === cat.id).sort((a, b) => a.position - b.position);
          return (
            <div key={cat.id} className="mb-3">
              <button
                onClick={() => toggleCollapsed(cat.id)}
                className="flex w-full items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted transition-colors hover:bg-surface-2/30 hover:text-foreground"
              >
                {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                {cat.name}
              </button>
              {!isCollapsed && <div className="mt-0.5 flex flex-col gap-1">{catChannels.map(renderChannelRow)}</div>}
            </div>
          );
        })}

      </div>
```

Only spacing utilities (`mb-2`→`mb-3`, `gap-0.5`→`gap-1`, added `mt-0.5`) and a hover background on the category toggle changed — the collapse/expand behavior, category ordering, and channel data are untouched.

- [ ] **Step 3: Run the verification commands**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 4: Manual check in the browser**

On the "Game Hub" test server's channel sidebar:
- Confirm the active channel shows the left accent bar and tinted background, and switching channels moves the bar correctly.
- Confirm hovering a non-active channel shows a visible background highlight.
- Confirm hovering a category header (with channels present) shows a background highlight, and clicking it still collapses/expands the channel list underneath.
- Confirm an unread channel's dot indicator still appears exactly as before.

- [ ] **Step 5: Commit**

```bash
git add src/components/GroupChannelsSidebar.tsx
git commit -m "Polish channel row active/hover states and category spacing"
```

---

### Task 3: Role-colored member names

**Files:**
- Modify: `src/components/GroupMembersList.tsx:115`

**Interfaces:**
- Consumes: the existing `tagColorClassName(color: string): string` helper, already imported in this file from `@/components/ServerChips` (line 11) and already used at lines 106 and 127 for the same purpose.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Color the member name by their role**

Find this line inside the `Row` function (currently line 115 of `src/components/GroupMembersList.tsx`):

```tsx
        <span className="truncate text-sm text-foreground">{member.displayName}</span>
```

Replace it with:

```tsx
        <span className={`truncate text-sm ${role ? tagColorClassName(role.color) : "text-foreground"}`}>
          {member.displayName}
        </span>
```

`role` is already computed at the top of `Row` (`const role = member.roleId ? roles.find((r) => r.id === member.roleId) : undefined;`, line 77) — no new lookup is needed.

- [ ] **Step 2: Run the verification commands**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 3: Manual check in the browser**

On the "Game Hub" test server's member list (right panel):
- Confirm a member who has a role with a color shows their display name in that color.
- Confirm a member with no role still shows their name in the normal foreground color.
- Confirm the role-name section headers (already colored) still look consistent with the newly-colored member names below them.

- [ ] **Step 4: Commit**

```bash
git add src/components/GroupMembersList.tsx
git commit -m "Color member names by their server role"
```

---

### Task 4: ServerRail hover motion polish

**Files:**
- Modify: `src/components/ServerRail.tsx:38` (the `ServerIcon` link's className)
- Modify: `src/components/ServerRail.tsx:77-79` (the Community link's className)
- Modify: `src/components/ServerRail.tsx:93` (the "Add a Server" button's className)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add a hover scale to the server icon**

Find this line (currently line 38 of `src/components/ServerRail.tsx`):

```tsx
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 ${
        active ? "rounded-2xl ring-2 ring-accent-bright" : "hover:rounded-2xl"
      }`}
```

Replace it with:

```tsx
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 hover:scale-110 ${
        active ? "rounded-2xl ring-2 ring-accent-bright" : "hover:rounded-2xl"
      }`}
```

- [ ] **Step 2: Add the same hover scale to the Community link**

Find this line (currently lines 77-79 of `src/components/ServerRail.tsx`):

```tsx
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
            onCommunity ? "rounded-2xl bg-accent text-black" : "bg-surface-2 text-foreground hover:rounded-2xl hover:bg-accent/20"
          }`}
```

Replace it with:

```tsx
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
            onCommunity ? "rounded-2xl bg-accent text-black" : "bg-surface-2 text-foreground hover:rounded-2xl hover:bg-accent/20"
          }`}
```

- [ ] **Step 3: Add the same hover scale to the "Add a Server" button**

Find this line (currently line 93 of `src/components/ServerRail.tsx`):

```tsx
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-emerald-400 transition-all duration-200 hover:rounded-2xl hover:bg-emerald-400/20"
```

Replace it with:

```tsx
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-emerald-400 transition-all duration-200 hover:scale-110 hover:rounded-2xl hover:bg-emerald-400/20"
```

- [ ] **Step 4: Run the verification commands**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 5: Manual check in the browser**

On the Community page (`/friends`):
- Hover the Community icon, the "Game Hub" server icon, and the "Add a Server" (+) button — confirm each grows slightly and still morphs from circle to rounded-square as before.
- Click the "Game Hub" server icon — confirm navigation and the active-state ring still work exactly as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/ServerRail.tsx
git commit -m "Add a subtle hover scale to the ServerRail icons"
```

---

### Task 5: End-to-end verification and cleanup

**Files:** none (verification-only task, no source changes expected).

**Interfaces:**
- Consumes: the combined output of Tasks 1-4, all in place.
- Produces: nothing — this is the plan's final task.

- [ ] **Step 1: Full-page manual walkthrough**

With all four tasks merged, open the "Game Hub" test server as `KyKy1` and walk through the whole page together (not just each task in isolation):
- Confirm the message list, channels sidebar, member list, and ServerRail all look and behave consistently with each other (no leftover bubble styling, no misaligned spacing between the new message rows and the rest of the page).
- Send a short back-and-forth as if two people were chatting (post from `KyKy1`, then switch to a different existing test account such as `Ohanaa` in another tab/session if convenient, then back) to confirm grouping behaves correctly with real alternating senders, not just consecutive same-sender messages.
- Resize the browser window narrower and confirm the redesigned message rows, channel list, and member list don't overflow or clip awkwardly (this project has no dedicated mobile layout for this page beyond what already existed, so the goal is "no worse than before," not new responsive behavior).

- [ ] **Step 2: Run the full verification suite one more time**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx eslint .`
Expected: no errors.

- [ ] **Step 3: Clean up test artifacts**

Delete any messages sent purely for verification during this plan (Tasks 1 and 5) using the in-app delete action, so the "Game Hub" test server is left in a clean state.

- [ ] **Step 4: Final commit (only if Step 1 surfaced fixes)**

If the full-page walkthrough in Step 1 required any small fixes, commit them now:

```bash
git add -A
git commit -m "Fix issues found in full-page server redesign walkthrough"
```

If nothing needed fixing, skip this step — Tasks 1-4's commits already cover the complete change.
