"use client";

import { ref, set, get, push, onValue, onChildAdded, off, remove, type DataSnapshot } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";

export interface GroupInvitePayload {
  groupId: string;
  groupName: string;
  fromCode: string;
  fromDisplayName: string;
  createdAt: number;
}

export interface GroupRosterEntry {
  displayName: string;
  badge?: string | null;
  joinedAt: number;
  // Per-user, per-server display override — set from the "Nickname" dropdown
  // item, shown instead of displayName in this server's message list and
  // member list only.
  nickname?: string | null;
  // Whether this member has opted in to showing the server's Tag (see
  // GroupTag below) next to their name here. Off by default — matches real
  // Discord requiring each member to "apply" the tag themselves.
  tagEquipped?: boolean;
  // Which single Role (see GroupRole below) this member has been assigned,
  // if any. One role per member — kept simple, no stacking.
  roleId?: string | null;
}

export interface GroupMessagePayload {
  senderCode: string;
  senderDisplayName: string;
  text: string;
  sentAt: number;
  clientId?: string;
  channelId?: string;
  mentions?: string[];
  imageDataUrl?: string;
}

// A friend can only be invited by code — invites are a lightweight
// notification only ("come join group X"); the actual member list lives in
// the group's roster, seeded once the invite is accepted.
export function sendGroupInvite(
  targetCode: string,
  groupId: string,
  groupName: string,
  fromCode: string,
  fromDisplayName: string
) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet — see the README for Firebase setup."));
  return push(ref(db, `groupInvites/${targetCode}`), {
    groupId,
    groupName,
    fromCode,
    fromDisplayName,
    createdAt: Date.now(),
  });
}

export function listenForGroupInvites(
  myCode: string,
  callback: (invites: Array<GroupInvitePayload & { id: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const inviteRef = ref(db, `groupInvites/${myCode}`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupInvitePayload> | null;
    callback(val ? Object.entries(val).map(([id, data]) => ({ id, ...data })) : []);
  };
  onValue(inviteRef, handler);
  return () => off(inviteRef, "value", handler);
}

export function removeGroupInvite(myCode: string, inviteId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupInvites/${myCode}/${inviteId}`));
}

// The roster is the live source of truth for "who's in this group" — every
// member's client mirrors it into their own local GroupMember rows whenever
// it changes, so a new member added by anyone shows up for everyone.
export async function joinGroupRoster(groupId: string, myCode: string, myDisplayName: string, myBadge?: string | null) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  const entryRef = ref(db, `groupChats/${groupId}/roster/${myCode}`);
  // Preserve the original join time and any nickname/tag/role choice across
  // repeat calls (e.g. revisiting the group page just to refresh a changed
  // badge/name) — this write replaces the whole entry, so anything not
  // explicitly carried forward here gets silently wiped.
  const existing = (await get(entryRef)).val() as GroupRosterEntry | null;
  return set(entryRef, {
    displayName: myDisplayName,
    badge: myBadge ?? null,
    joinedAt: existing?.joinedAt ?? Date.now(),
    nickname: existing?.nickname ?? null,
    tagEquipped: existing?.tagEquipped ?? false,
    roleId: existing?.roleId ?? null,
  });
}

// Updates only the nickname, leaving displayName/badge/joinedAt untouched.
export async function setGroupNickname(groupId: string, myCode: string, nickname: string | null) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/roster/${myCode}/nickname`), nickname);
}

export async function setTagEquipped(groupId: string, myCode: string, equipped: boolean) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/roster/${myCode}/tagEquipped`), equipped);
}

export function leaveGroupRoster(groupId: string, myCode: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupChats/${groupId}/roster/${myCode}`));
}

// Also used to kick someone else — removing any code from the roster works
// the same way regardless of whose code it is. The kicked member's own
// client notices its code is missing next time the roster listener fires
// (see the "kicked or server deleted" check in GroupChatWindow) and cleans
// up locally on its own; there's no central authority to push that to them.
export function setMemberRole(groupId: string, code: string, roleId: string | null) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `groupChats/${groupId}/roster/${code}/roleId`), roleId);
}

export function listenForGroupRoster(
  groupId: string,
  callback: (roster: Array<GroupRosterEntry & { code: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const rosterRef = ref(db, `groupChats/${groupId}/roster`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupRosterEntry> | null;
    callback(val ? Object.entries(val).map(([code, data]) => ({ code, ...data })) : []);
  };
  onValue(rosterRef, handler);
  return () => off(rosterRef, "value", handler);
}

// Group messages are NOT deleted after a single read — several members may
// still need to receive the same message, so they stay in Firebase as the
// group's live feed. Each member's local SQLite copy is still their own
// personal record of the conversation.
export function sendGroupMessage(
  groupId: string,
  senderCode: string,
  senderDisplayName: string,
  text: string,
  clientId: string,
  channelId: string,
  mentions?: string[],
  imageDataUrl?: string
) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return push(ref(db, `groupChats/${groupId}/messages`), {
    senderCode,
    senderDisplayName,
    text,
    sentAt: Date.now(),
    clientId,
    channelId,
    mentions: mentions && mentions.length > 0 ? mentions : null,
    imageDataUrl: imageDataUrl ?? null,
  });
}

export function listenForGroupMessages(
  groupId: string,
  myCode: string,
  onMessage: (message: GroupMessagePayload, messageId: string) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const msgRef = ref(db, `groupChats/${groupId}/messages`);
  const handler = (snapshot: DataSnapshot) => {
    const message = snapshot.val() as GroupMessagePayload | null;
    if (!message || !snapshot.key) return;
    if (message.senderCode === myCode) return; // our own echo — already saved on send
    onMessage(message, snapshot.key);
  };
  onChildAdded(msgRef, handler);
  return () => off(msgRef, "child_added", handler);
}

// Edits and deletes are live overlays keyed by the message's shared clientId
// — same "onValue on the whole path" pattern as reactions/pinned, not
// onChildAdded, so every fresh subscribe just gets "current state" rather
// than replaying a history of edit events.
export function editGroupMessage(groupId: string, clientId: string, newText: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/edits/${clientId}`), newText);
}

export function listenForGroupMessageEdits(groupId: string, onChange: (edits: Record<string, string>) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const editsRef = ref(db, `groupChats/${groupId}/edits`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as Record<string, string> | null) ?? {});
  onValue(editsRef, handler);
  return () => off(editsRef, "value", handler);
}

export function deleteGroupMessage(groupId: string, clientId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `groupChats/${groupId}/deletedMessages/${clientId}`), true);
}

export function listenForGroupMessageDeletes(groupId: string, onChange: (deletedClientIds: Set<string>) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const deletedRef = ref(db, `groupChats/${groupId}/deletedMessages`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, boolean> | null;
    onChange(new Set(val ? Object.keys(val) : []));
  };
  onValue(deletedRef, handler);
  return () => off(deletedRef, "value", handler);
}

// Typing indicator — a timestamp per member, refreshed on keystroke and
// treated as stale by viewers after a few seconds (no server-side expiry,
// Firebase just holds "last time they typed").
export function setTyping(groupId: string, myCode: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `groupChats/${groupId}/typing/${myCode}`), Date.now());
}

export function listenForTyping(groupId: string, onChange: (typing: Record<string, number>) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const typingRef = ref(db, `groupChats/${groupId}/typing`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as Record<string, number> | null) ?? {});
  onValue(typingRef, handler);
  return () => off(typingRef, "value", handler);
}

// Channels and categories live in Firebase only — same "no local mirror"
// pattern as the rest of the server's metadata. A server with no `channels`
// node yet is treated by the UI as having exactly one implicit text channel
// and one implicit voice channel (matching pre-channels behavior); these
// fixed ids get materialized for real the first time anyone adds another
// channel, via ensureDefaultChannels.
export const DEFAULT_TEXT_CHANNEL_ID = "general";
export const DEFAULT_VOICE_CHANNEL_ID = "general-voice";

export interface GroupChannel {
  name: string;
  type: "text" | "voice";
  categoryId: string | null;
  position: number;
}

export interface GroupCategory {
  name: string;
  position: number;
}

export function listenForGroupChannels(
  groupId: string,
  onChange: (channels: Array<GroupChannel & { id: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const channelsRef = ref(db, `groupChats/${groupId}/channels`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupChannel> | null;
    onChange(val ? Object.entries(val).map(([id, data]) => ({ id, ...data })) : []);
  };
  onValue(channelsRef, handler);
  return () => off(channelsRef, "value", handler);
}

export function listenForGroupCategories(
  groupId: string,
  onChange: (categories: Array<GroupCategory & { id: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const categoriesRef = ref(db, `groupChats/${groupId}/categories`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupCategory> | null;
    onChange(val ? Object.entries(val).map(([id, data]) => ({ id, ...data })) : []);
  };
  onValue(categoriesRef, handler);
  return () => off(categoriesRef, "value", handler);
}

async function ensureDefaultChannels(groupId: string) {
  const db = getFirebaseDb();
  if (!db) return;
  const snapshot = await get(ref(db, `groupChats/${groupId}/channels`));
  if (snapshot.exists()) return;
  await set(ref(db, `groupChats/${groupId}/channels`), {
    [DEFAULT_TEXT_CHANNEL_ID]: { name: "general", type: "text", categoryId: null, position: 0 },
    [DEFAULT_VOICE_CHANNEL_ID]: { name: "General", type: "voice", categoryId: null, position: 1 },
  });
}

export async function createGroupChannel(
  groupId: string,
  name: string,
  type: "text" | "voice",
  categoryId: string | null
): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Groups aren't set up yet.");
  await ensureDefaultChannels(groupId);
  const newRef = push(ref(db, `groupChats/${groupId}/channels`));
  await set(newRef, { name, type, categoryId, position: Date.now() });
  return newRef.key!;
}

export function deleteGroupChannel(groupId: string, channelId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupChats/${groupId}/channels/${channelId}`));
}

export async function createGroupCategory(groupId: string, name: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Groups aren't set up yet.");
  await ensureDefaultChannels(groupId);
  const newRef = push(ref(db, `groupChats/${groupId}/categories`));
  await set(newRef, { name, position: Date.now() });
  return newRef.key!;
}

// Moves any channels in this category to "uncategorized" rather than
// deleting them, then removes the category itself.
export async function deleteGroupCategory(groupId: string, categoryId: string) {
  const db = getFirebaseDb();
  if (!db) return;
  const snapshot = await get(ref(db, `groupChats/${groupId}/channels`));
  const channels = (snapshot.val() as Record<string, GroupChannel>) ?? {};
  await Promise.all(
    Object.entries(channels)
      .filter(([, ch]) => ch.categoryId === categoryId)
      .map(([id]) => set(ref(db, `groupChats/${groupId}/channels/${id}/categoryId`), null))
  );
  await remove(ref(db, `groupChats/${groupId}/categories/${categoryId}`));
}

// The group's icon — live in Firebase only (like the roster), any member can
// set it. No local mirror: if you're offline you just see the default icon.
export function setGroupIcon(groupId: string, iconDataUrl: string | null) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/icon`), iconDataUrl);
}

export function listenForGroupIcon(groupId: string, onChange: (iconDataUrl: string | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const iconRef = ref(db, `groupChats/${groupId}/icon`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as string | null) ?? null);
  onValue(iconRef, handler);
  return () => off(iconRef, "value", handler);
}

// The server's display name, persisted once at creation so someone who only
// has the invite code (and isn't a member yet) can look up what they're
// about to join before committing.
export function setGroupName(groupId: string, name: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/name`), name);
}

// Renames are broadcast live so anyone currently viewing the server sees the
// change instantly — same "no local mirror" pattern as the icon.
export function listenForGroupName(groupId: string, onChange: (name: string | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const nameRef = ref(db, `groupChats/${groupId}/name`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as string | null) ?? null);
  onValue(nameRef, handler);
  return () => off(nameRef, "value", handler);
}

// Per-user mute flag for a server's message notifications — keyed by the
// viewer's own code so muting only affects your own client.
export function setGroupMuted(groupId: string, myCode: string, muted: boolean) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `groupChats/${groupId}/muted/${myCode}`), muted);
}

export function listenForGroupMuted(groupId: string, myCode: string, onChange: (muted: boolean) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const mutedRef = ref(db, `groupChats/${groupId}/muted/${myCode}`);
  const handler = (snapshot: DataSnapshot) => onChange(Boolean(snapshot.val()));
  onValue(mutedRef, handler);
  return () => off(mutedRef, "value", handler);
}

export interface GroupPreview {
  name: string;
  icon: string | null;
  memberCount: number;
  banner?: string | null;
}

// One-shot lookup used by the "Join a Server" flow — resolves null if no
// server with that invite code has ever set its name (i.e. it doesn't exist).
export async function fetchGroupPreview(groupId: string): Promise<GroupPreview | null> {
  const db = getFirebaseDb();
  if (!db) return null;
  const snapshot = await get(ref(db, `groupChats/${groupId}`));
  const val = snapshot.val() as {
    name?: string;
    icon?: string | null;
    roster?: Record<string, unknown>;
    profile?: { banner?: string | null };
  } | null;
  if (!val?.name) return null;
  return {
    name: val.name,
    icon: val.icon ?? null,
    memberCount: val.roster ? Object.keys(val.roster).length : 0,
    banner: val.profile?.banner ?? null,
  };
}

// The creation timestamp, set once by the creator and never overwritten —
// used to show "Established <date>" consistently for every member.
export function setGroupCreatedAt(groupId: string, timestamp: number) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `groupChats/${groupId}/createdAt`), timestamp);
}

export function listenForGroupCreatedAt(groupId: string, onChange: (timestamp: number | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const createdRef = ref(db, `groupChats/${groupId}/createdAt`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as number | null) ?? null);
  onValue(createdRef, handler);
  return () => off(createdRef, "value", handler);
}

// The server's optional "profile" flourish — banner color, description, and
// up to 5 short traits — all live-only (like the icon/name), edited together
// as one unit from the Server Settings panel.
export interface GroupProfile {
  banner?: string | null;
  description?: string;
  traits?: string[];
}

export function setGroupProfile(groupId: string, profile: GroupProfile) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/profile`), profile);
}

export function listenForGroupProfile(groupId: string, onChange: (profile: GroupProfile) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const profileRef = ref(db, `groupChats/${groupId}/profile`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as GroupProfile | null) ?? {});
  onValue(profileRef, handler);
  return () => off(profileRef, "value", handler);
}

// The server's Tag — a short chip members can opt into showing next to their
// name here (see roster.tagEquipped). No boost/payment gate: this app has no
// monetization system, so it's just freely configurable, unlike real Discord.
export interface GroupTag {
  name: string;
  badge: string;
  color: string;
}

export function setGroupTag(groupId: string, tag: GroupTag) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/tag`), tag);
}

export function listenForGroupTag(groupId: string, onChange: (tag: GroupTag | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const tagRef = ref(db, `groupChats/${groupId}/tag`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as GroupTag | null) ?? null);
  onValue(tagRef, handler);
  return () => off(tagRef, "value", handler);
}

// Only one pinned message at a time, referenced by its shared clientId.
export function setPinnedMessage(groupId: string, clientId: string | null) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/pinned`), clientId);
}

export function listenForPinnedMessage(groupId: string, onChange: (clientId: string | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const pinnedRef = ref(db, `groupChats/${groupId}/pinned`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as string | null) ?? null);
  onValue(pinnedRef, handler);
  return () => off(pinnedRef, "value", handler);
}

// The creator's code, set once at creation and never overwritten — the only
// thing gated by it is Delete Server, everything else stays open to all
// members (same permissive model the rest of server settings already uses).
export function setGroupCreator(groupId: string, code: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `groupChats/${groupId}/creatorCode`), code);
}

export function listenForGroupCreator(groupId: string, onChange: (code: string | null) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const creatorRef = ref(db, `groupChats/${groupId}/creatorCode`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as string | null) ?? null);
  onValue(creatorRef, handler);
  return () => off(creatorRef, "value", handler);
}

// Deletes the whole server for everyone — wipes every live path under this
// groupId. Other members detect this the same way they'd detect a kick (see
// setMemberRole's comment): their roster listener fires with an empty/missing
// roster, and their own client cleans up its local copy in response.
export function deleteGroupEverywhere(groupId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupChats/${groupId}`));
}

// Per-server ban list — separate from a kick, this also blocks rejoining by
// code (checked in the "Join a Server" flow) until unbanned.
export interface GroupBanEntry {
  displayName: string;
  bannedAt: number;
}

export function banFromGroup(groupId: string, code: string, displayName: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return set(ref(db, `groupChats/${groupId}/bans/${code}`), { displayName, bannedAt: Date.now() });
}

export function unbanFromGroup(groupId: string, code: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupChats/${groupId}/bans/${code}`));
}

export function listenForGroupBans(
  groupId: string,
  onChange: (bans: Array<GroupBanEntry & { code: string }>) => void
) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const bansRef = ref(db, `groupChats/${groupId}/bans`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupBanEntry> | null;
    onChange(val ? Object.entries(val).map(([code, data]) => ({ code, ...data })) : []);
  };
  onValue(bansRef, handler);
  return () => off(bansRef, "value", handler);
}

export async function isBannedFromGroup(groupId: string, code: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (!db) return false;
  const snapshot = await get(ref(db, `groupChats/${groupId}/bans/${code}`));
  return snapshot.exists();
}

// Roles are just a colored name label — no permissions or channel access
// gating, one per member (see roster.roleId / setMemberRole above).
export interface GroupRole {
  name: string;
  color: string;
  position: number;
}

export async function createGroupRole(groupId: string, name: string, color: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Groups aren't set up yet.");
  const newRef = push(ref(db, `groupChats/${groupId}/roles`));
  await set(newRef, { name, color, position: Date.now() });
  return newRef.key!;
}

// Also clears the role from anyone currently assigned it, so no roster entry
// is left pointing at a role id that no longer exists.
export async function deleteGroupRole(groupId: string, roleId: string) {
  const db = getFirebaseDb();
  if (!db) return;
  const rosterSnapshot = await get(ref(db, `groupChats/${groupId}/roster`));
  const roster = (rosterSnapshot.val() as Record<string, GroupRosterEntry>) ?? {};
  await Promise.all(
    Object.entries(roster)
      .filter(([, entry]) => entry.roleId === roleId)
      .map(([code]) => set(ref(db, `groupChats/${groupId}/roster/${code}/roleId`), null))
  );
  await remove(ref(db, `groupChats/${groupId}/roles/${roleId}`));
}

export function listenForGroupRoles(groupId: string, onChange: (roles: Array<GroupRole & { id: string }>) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const rolesRef = ref(db, `groupChats/${groupId}/roles`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupRole> | null;
    onChange(val ? Object.entries(val).map(([id, data]) => ({ id, ...data })) : []);
  };
  onValue(rolesRef, handler);
  return () => off(rolesRef, "value", handler);
}

// A basic word filter — messages containing any of these (case-insensitive,
// substring match) get blocked client-side before ever reaching Firebase.
// No ML/pattern matching, just an exact word/phrase list — kept deliberately
// simple.
export function setGroupBannedWords(groupId: string, words: string[]) {
  const db = getFirebaseDb();
  if (!db) return Promise.reject(new Error("Groups aren't set up yet."));
  return set(ref(db, `groupChats/${groupId}/automod/bannedWords`), words);
}

export function listenForGroupBannedWords(groupId: string, onChange: (words: string[]) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const wordsRef = ref(db, `groupChats/${groupId}/automod/bannedWords`);
  const handler = (snapshot: DataSnapshot) => onChange((snapshot.val() as string[] | null) ?? []);
  onValue(wordsRef, handler);
  return () => off(wordsRef, "value", handler);
}

// Custom server emoji, referenced in message text as :name: and rendered
// inline as a small image (see GroupChatWindow's message renderer) — not
// usable as reactions, which are keyed by literal emoji character in
// Firebase and don't have room for arbitrary image data.
export interface GroupEmoji {
  name: string;
  dataUrl: string;
}

export async function createGroupEmoji(groupId: string, name: string, dataUrl: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Groups aren't set up yet.");
  const newRef = push(ref(db, `groupChats/${groupId}/emoji`));
  await set(newRef, { name, dataUrl });
  return newRef.key!;
}

export function deleteGroupEmoji(groupId: string, emojiId: string) {
  const db = getFirebaseDb();
  if (!db) return Promise.resolve();
  return remove(ref(db, `groupChats/${groupId}/emoji/${emojiId}`));
}

export function listenForGroupEmoji(groupId: string, onChange: (emoji: Array<GroupEmoji & { id: string }>) => void) {
  const db = getFirebaseDb();
  if (!db) return () => {};
  const emojiRef = ref(db, `groupChats/${groupId}/emoji`);
  const handler = (snapshot: DataSnapshot) => {
    const val = snapshot.val() as Record<string, GroupEmoji> | null;
    onChange(val ? Object.entries(val).map(([id, data]) => ({ id, ...data })) : []);
  };
  onValue(emojiRef, handler);
  return () => off(emojiRef, "value", handler);
}
