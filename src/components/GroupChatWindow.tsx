"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Send, Hash, Pin, PinOff, X, UserPlus, ImagePlus, MessageSquare, Copy, Check, Pencil, Trash2, Search } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { formatFriendCode } from "@/lib/friendCode";
import Avatar from "@/components/Avatar";
import {
  joinGroupRoster,
  isBannedFromGroup,
  listenForGroupRoster,
  listenForGroupMessages,
  sendGroupMessage,
  editGroupMessage,
  deleteGroupMessage,
  listenForGroupMessageEdits,
  listenForGroupMessageDeletes,
  setTyping,
  listenForTyping,
  listenForPinnedMessage,
  setPinnedMessage,
  listenForGroupChannels,
  listenForGroupTag,
  listenForGroupRoles,
  listenForGroupBannedWords,
  listenForGroupEmoji,
  listenForGroupCreator,
  DEFAULT_TEXT_CHANNEL_ID,
  type GroupRosterEntry,
  type GroupChannel,
  type GroupTag,
  type GroupRole,
  type GroupEmoji,
} from "@/lib/groupRealtime";
import { listenForReactions, toggleReaction, type ReactionMap } from "@/lib/reactionsRealtime";
import { getModerationState, isRestricted } from "@/lib/moderationRealtime";
import { useToast } from "@/context/ToastContext";
import { CosmeticBadge } from "@/components/CosmeticFrame";
import { fetchProfile, type PublicProfile } from "@/lib/profileRealtime";
import FriendProfileModal from "@/components/FriendProfileModal";
import MessageReactions from "@/components/MessageReactions";
import GroupChannelsSidebar, { DEFAULT_CHANNELS } from "@/components/GroupChannelsSidebar";
import { TagChip, NicknameModal, type GroupMemberEntry } from "@/components/ServerChips";
import { RoleChip } from "@/components/ServerModerationTabs";
import MemberContextMenu, { type MemberContextMenuTarget } from "@/components/MemberContextMenu";
import GroupMembersList from "@/components/GroupMembersList";

const MAX_IMAGE_DATA_URL_LENGTH = 800_000;
const TYPING_THROTTLE_MS = 2000;
const TYPING_STALE_MS = 3000;

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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

function extractMentions(text: string, members: Array<{ code: string; displayName: string }>): string[] {
  const codes = new Set<string>();
  for (const m of members) {
    if (!m.displayName) continue;
    if (new RegExp(`@${escapeRegExp(m.displayName)}\\b`, "i").test(text)) codes.add(m.code);
  }
  return [...codes];
}

// Combined tokenizer for a message body: custom emoji shortcodes, @mentions
// of current members, and #channel-name links all get spotted in one pass
// and rendered as their own inline element; everything else is plain text.
function renderMessageContent(
  text: string,
  emoji: Array<GroupEmoji & { id: string }>,
  members: Array<{ code: string; displayName: string }>,
  channels: Array<GroupChannel & { id: string }>,
  onChannelClick: (channelId: string) => void
): ReactNode[] {
  const byEmojiName = new Map(emoji.map((e) => [e.name, e]));
  const byMemberName = new Map(members.filter((m) => m.displayName).map((m) => [m.displayName.toLowerCase(), m]));
  const byChannelName = new Map(channels.filter((c) => c.type === "text").map((c) => [c.name.toLowerCase(), c]));

  const memberNames = [...new Set(members.map((m) => m.displayName).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const channelNames = [...new Set(channels.filter((c) => c.type === "text").map((c) => c.name).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);

  const patternParts = [
    ":[a-zA-Z0-9_]+:",
    ...(memberNames.length ? [`@(?:${memberNames.join("|")})`] : []),
    ...(channelNames.length ? [`#(?:${channelNames.join("|")})`] : []),
  ];
  const parts = text.split(new RegExp(`(${patternParts.join("|")})`, "g"));

  return parts
    .filter((part) => part !== undefined && part !== "")
    .map((part, i) => {
      const emojiMatch = /^:([a-zA-Z0-9_]+):$/.exec(part);
      if (emojiMatch) {
        const found = byEmojiName.get(emojiMatch[1]);
        if (found) {
          return (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img key={i} src={found.dataUrl} alt={part} title={part} className="inline-block h-5 w-5 align-text-bottom" />
          );
        }
      }
      if (part.startsWith("@")) {
        const found = byMemberName.get(part.slice(1).toLowerCase());
        if (found) {
          return (
            // A solid accent background with dark text stays legible across
            // every theme — text-accent-bright on a semi-transparent accent
            // background (the old style) collapsed into near-identical hues
            // on themes like Dark Red, making mentions unreadable.
            <span key={i} className="rounded bg-accent-bright px-1 font-medium text-black">
              {part}
            </span>
          );
        }
      }
      if (part.startsWith("#")) {
        const found = byChannelName.get(part.slice(1).toLowerCase());
        if (found) {
          return (
            <button
              key={i}
              type="button"
              onClick={() => onChannelClick(found.id)}
              className="rounded bg-surface-2 px-1 font-medium text-accent-bright hover:underline"
            >
              {part}
            </button>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
}

function resizeImageForChat(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 720;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas isn't supported in this browser."));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      let quality = 0.82;
      let dataUrl = canvas.toDataURL("image/jpeg", quality);
      while (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH && quality > 0.35) {
        quality -= 0.12;
        dataUrl = canvas.toDataURL("image/jpeg", quality);
      }
      URL.revokeObjectURL(img.src);
      if (dataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
        reject(new Error("That image is too large, even compressed."));
        return;
      }
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = URL.createObjectURL(file);
  });
}

// Read receipts are purely local — a per-channel "last time I looked at
// this" timestamp in localStorage, since nothing about unread state needs
// to be shared with anyone else.
function getLastReadStorage(groupId: string, channelId: string): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(`gh:lastRead:${groupId}:${channelId}`);
  return raw ? Number(raw) || 0 : 0;
}

function setLastReadStorage(groupId: string, channelId: string, ts: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`gh:lastRead:${groupId}:${channelId}`, String(ts));
}

interface GroupMember {
  id: string;
  memberCode: string;
  memberDisplayName: string;
  memberBadge?: string | null;
}

interface GroupMessage {
  id: string;
  senderCode: string;
  senderDisplayName: string;
  text: string;
  sentAt: string | Date;
  clientId?: string | null;
  channelId?: string | null;
  imageDataUrl?: string | null;
}

export default function GroupChatWindow({
  groupId,
  groupName,
  myCode,
  myDisplayName,
  myBadge,
  myAvatarDataUrl,
  myEquippedFrame,
  initialMembers,
  initialMessages,
}: {
  groupId: string;
  groupName: string;
  myCode: string;
  myDisplayName: string;
  myBadge?: string | null;
  myAvatarDataUrl?: string | null;
  myEquippedFrame?: string | null;
  initialMembers: GroupMember[];
  initialMessages: GroupMessage[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [members, setMembers] = useState(initialMembers);
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [viewingMember, setViewingMember] = useState<{ code: string; displayName: string; badge?: string | null; roleId?: string | null } | null>(
    null
  );
  const [reactions, setReactions] = useState<ReactionMap>({});
  const [pinnedClientId, setPinnedClientId] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [channels, setChannels] = useState<Array<GroupChannel & { id: string }>>([]);
  const [activeChannelId, setActiveChannelId] = useState(DEFAULT_TEXT_CHANNEL_ID);
  const [nicknames, setNicknames] = useState<Record<string, string>>({});
  const [tagEquippedCodes, setTagEquippedCodes] = useState<Set<string>>(new Set());
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>({});
  const [tag, setTag] = useState<GroupTag | null>(null);
  const [roles, setRoles] = useState<Array<GroupRole & { id: string }>>([]);
  const [bannedWords, setBannedWords] = useState<string[]>([]);
  const [emoji, setEmoji] = useState<Array<GroupEmoji & { id: string }>>([]);
  const [creatorCode, setCreatorCode] = useState<string | null>(null);
  const [msgMenuTarget, setMsgMenuTarget] = useState<MemberContextMenuTarget | null>(null);
  const [editingNicknameFor, setEditingNicknameFor] = useState<GroupMemberEntry | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [typingMap, setTypingMap] = useState<Record<string, number>>({});
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [lastReadMap, setLastReadMap] = useState<Record<string, number>>({});
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const membersRef = useRef(members);
  const fetchedProfileCodesRef = useRef<Set<string>>(new Set());
  const messageInputRef = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const lastTypingSentRef = useRef(0);
  const reactionsPath = `groupReactions/${groupId}`;

  useEffect(() => {
    return listenForGroupChannels(groupId, setChannels);
  }, [groupId]);

  useEffect(() => {
    // Each member's photo lives in their own installation's published
    // profile, not this server's roster mirror — fetch it once per member
    // seen, same one-shot lookup GroupMembersList already uses.
    for (const m of members) {
      if (fetchedProfileCodesRef.current.has(m.memberCode)) continue;
      fetchedProfileCodesRef.current.add(m.memberCode);
      fetchProfile(m.memberCode).then((profile) => {
        if (profile) setProfiles((prev) => ({ ...prev, [m.memberCode]: profile }));
      });
    }
  }, [members]);

  useEffect(() => {
    return listenForGroupTag(groupId, setTag);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupRoles(groupId, setRoles);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupBannedWords(groupId, setBannedWords);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupEmoji(groupId, setEmoji);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupCreator(groupId, setCreatorCode);
  }, [groupId]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return listenForReactions(reactionsPath, setReactions);
  }, [reactionsPath]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return listenForPinnedMessage(groupId, setPinnedClientId);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupMessageEdits(groupId, setEdits);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupMessageDeletes(groupId, setDeletedIds);
  }, [groupId]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return listenForTyping(groupId, setTypingMap);
  }, [groupId]);

  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastReadMap((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const c of channels) {
        if (!(c.id in next)) {
          next[c.id] = getLastReadStorage(groupId, c.id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [channels, groupId]);

  useEffect(() => {
    // Re-mark as read whenever the message count changes while this channel
    // is open, not just on channel switch.
    const now = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastReadMap((prev) => ({ ...prev, [activeChannelId]: now }));
    setLastReadStorage(groupId, activeChannelId, now);
  }, [activeChannelId, groupId, messages.length]);

  useEffect(() => {
    membersRef.current = members;
  }, [members]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    let unsubRoster = () => {};
    let unsubMessages = () => {};
    let cancelled = false;

    // A banned member can still have a local copy of this group from before
    // (a bookmark, browser history) — block re-joining the live roster here
    // too, not just in the "Join a Server by code" flow.
    isBannedFromGroup(groupId, myCode).then(async (banned) => {
      if (cancelled) return;
      if (banned) {
        try {
          await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
        } catch {
          // best-effort
        }
        showToast("You've been banned from this server.", "error");
        router.push("/friends");
        router.refresh();
        return;
      }

      // Wait for our own join write to land before subscribing — otherwise
      // the very first roster snapshot can fire before we're in it yet,
      // which would look identical to having been kicked.
      await joinGroupRoster(groupId, myCode, myDisplayName, myBadge).catch(() => {});
      if (cancelled) return;

      unsubRoster = listenForGroupRoster(groupId, async (roster: Array<GroupRosterEntry & { code: string }>) => {
          const currentCodes = new Set(roster.map((r) => r.code));

          if (!currentCodes.has(myCode)) {
            // Kicked, or the whole server was deleted — either way we're no
            // longer a member. Clean up our local copy and leave.
            try {
              await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
            } catch {
              // best-effort
            }
            showToast("You're no longer a member of this server.", "error");
            router.push("/friends");
            router.refresh();
            return;
          }

          setNicknames(
            Object.fromEntries(roster.filter((r) => r.nickname).map((r) => [r.code, r.nickname as string]))
          );
          setTagEquippedCodes(new Set(roster.filter((r) => r.tagEquipped).map((r) => r.code)));
          setMemberRoles(
            Object.fromEntries(roster.filter((r) => r.roleId).map((r) => [r.code, r.roleId as string]))
          );

          const known = new Set(membersRef.current.map((m) => m.memberCode));

          for (const entry of roster) {
            if (entry.code === myCode) continue;
            if (known.has(entry.code)) continue;
            const res = await fetch(`/api/groups/${groupId}/members`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                memberCode: entry.code,
                memberDisplayName: entry.displayName,
                memberBadge: entry.badge,
              }),
            });
            if (res.ok) {
              const { member } = await res.json();
              setMembers((prev) => [...prev.filter((m) => m.memberCode !== member.memberCode), member]);
            }
          }

          for (const m of membersRef.current) {
            if (m.memberCode !== myCode && !currentCodes.has(m.memberCode)) {
              await fetch(`/api/groups/${groupId}/members?memberCode=${m.memberCode}`, { method: "DELETE" });
              setMembers((prev) => prev.filter((mem) => mem.memberCode !== m.memberCode));
            }
          }
        });

        unsubMessages = listenForGroupMessages(groupId, myCode, async (message, messageId) => {
          const res = await fetch(`/api/groups/${groupId}/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              senderCode: message.senderCode,
              senderDisplayName: message.senderDisplayName,
              text: message.text,
              clientId: message.clientId,
              channelId: message.channelId ?? DEFAULT_TEXT_CHANNEL_ID,
              imageDataUrl: message.imageDataUrl ?? null,
            }),
          });
          if (res.ok) {
            const { message: saved } = await res.json();
            setMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
          }
          void messageId;
        });
      });

    return () => {
      cancelled = true;
      unsubRoster();
      unsubMessages();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, myCode]);

  function handleTextChange(value: string) {
    setText(value);
    const now = Date.now();
    if (isFirebaseConfigured && now - lastTypingSentRef.current > TYPING_THROTTLE_MS) {
      lastTypingSentRef.current = now;
      setTyping(groupId, myCode).catch(() => {});
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Pick an image file.", "error");
      if (attachInputRef.current) attachInputRef.current.value = "";
      return;
    }
    setAttaching(true);
    try {
      const dataUrl = await resizeImageForChat(file);
      setImagePreview(dataUrl);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't attach that image.", "error");
    } finally {
      setAttaching(false);
      if (attachInputRef.current) attachInputRef.current.value = "";
    }
  }

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed && !imagePreview) return;

    const myState = await getModerationState(myCode);
    const { restricted, reason } = isRestricted(myState);
    if (restricted) {
      showToast(reason, "error");
      return;
    }

    if (trimmed) {
      const lower = trimmed.toLowerCase();
      if (bannedWords.some((word) => word && lower.includes(word))) {
        showToast("That message was blocked by this server's AutoMod.", "error");
        return;
      }
    }

    const mentions = trimmed ? extractMentions(trimmed, allMembers) : [];
    const imageToSend = imagePreview;
    setText("");
    setImagePreview(null);
    const clientId = crypto.randomUUID();

    try {
      await sendGroupMessage(groupId, myCode, myDisplayName, trimmed, clientId, activeChannelId, mentions, imageToSend ?? undefined);
      const res = await fetch(`/api/groups/${groupId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderCode: myCode,
          senderDisplayName: myDisplayName,
          text: trimmed,
          clientId,
          channelId: activeChannelId,
          imageDataUrl: imageToSend ?? null,
        }),
      });
      if (res.ok) {
        const { message: saved } = await res.json();
        setMessages((prev) => [...prev, saved]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send message.", "error");
    }
  }

  function startEdit(m: GroupMessage) {
    if (!m.clientId) return;
    setEditingClientId(m.clientId);
    setEditDraft(edits[m.clientId] ?? m.text);
  }

  function cancelEdit() {
    setEditingClientId(null);
    setEditDraft("");
  }

  async function saveEdit() {
    if (!editingClientId) return;
    const trimmed = editDraft.trim();
    if (!trimmed) {
      showToast("Message can't be empty.", "error");
      return;
    }
    try {
      await editGroupMessage(groupId, editingClientId, trimmed);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't edit message.", "error");
    }
    setEditingClientId(null);
    setEditDraft("");
  }

  async function handleDeleteMessage(clientId: string) {
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteGroupMessage(groupId, clientId);
    } catch {
      showToast("Couldn't delete message.", "error");
    }
  }

  function copyInviteCode() {
    navigator.clipboard.writeText(formatFriendCode(groupId));
    setCopiedInvite(true);
    setTimeout(() => setCopiedInvite(false), 2000);
  }

  function scrollToMessage(clientId: string) {
    const el = document.getElementById(`msg-${clientId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function insertMention(member: GroupMemberEntry) {
    setText((prev) => (prev.trim() ? prev.trim() + " " : "") + `@${member.displayName} `);
    messageInputRef.current?.focus();
  }

  const pinnedMessage = pinnedClientId ? messages.find((m) => m.clientId === pinnedClientId) : null;
  const isBrandNew = activeChannelId === DEFAULT_TEXT_CHANNEL_ID && messages.length === 0 && members.length === 0;
  const visibleMessages = messages.filter(
    (m) => (m.channelId ?? DEFAULT_TEXT_CHANNEL_ID) === activeChannelId && !(m.clientId && deletedIds.has(m.clientId))
  );
  const searchedMessages = searchQuery.trim()
    ? visibleMessages.filter((m) => {
        const displayText = (m.clientId ? edits[m.clientId] : undefined) ?? m.text;
        return displayText.toLowerCase().includes(searchQuery.trim().toLowerCase());
      })
    : visibleMessages;
  const displayChannels = channels.length > 0 ? channels : DEFAULT_CHANNELS;
  const activeChannelName = displayChannels.find((c) => c.id === activeChannelId)?.name ?? "general";
  const isSearching = searchQuery.trim().length > 0;
  const messageGroups: MessageGroup[] = isSearching
    ? searchedMessages.map((m) => ({ senderCode: m.senderCode, messages: [m] }))
    : buildGroups(searchedMessages);
  const allMembers = [
    {
      code: myCode,
      displayName: nicknames[myCode] ?? myDisplayName,
      badge: myBadge,
      tagEquipped: tagEquippedCodes.has(myCode),
      roleId: memberRoles[myCode] ?? null,
    },
    ...members.map((m) => ({
      code: m.memberCode,
      displayName: nicknames[m.memberCode] ?? m.memberDisplayName,
      badge: m.memberBadge,
      tagEquipped: tagEquippedCodes.has(m.memberCode),
      roleId: memberRoles[m.memberCode] ?? null,
    })),
  ];

  const unreadChannelIds = (() => {
    const set = new Set<string>();
    for (const m of messages) {
      if (m.clientId && deletedIds.has(m.clientId)) continue;
      const cid = m.channelId ?? DEFAULT_TEXT_CHANNEL_ID;
      if (cid === activeChannelId) continue;
      if (m.senderCode === myCode) continue;
      if (new Date(m.sentAt).getTime() > (lastReadMap[cid] ?? 0)) set.add(cid);
    }
    return set;
  })();

  const typingNow = nowTick;
  const typingNames = Object.entries(typingMap)
    .filter(([code, ts]) => code !== myCode && typingNow - ts < TYPING_STALE_MS)
    .map(([code]) => nicknames[code] ?? allMembers.find((m) => m.code === code)?.displayName ?? "Someone");

  return (
    <div className="flex h-full min-h-0 flex-1 gap-0 overflow-hidden rounded-2xl border border-border/60">
      <GroupChannelsSidebar
        groupId={groupId}
        groupName={groupName}
        myCode={myCode}
        myDisplayName={myDisplayName}
        myBadge={myBadge}
        myAvatarDataUrl={myAvatarDataUrl}
        myEquippedFrame={myEquippedFrame}
        members={allMembers}
        activeChannelId={activeChannelId}
        onSelectChannel={setActiveChannelId}
        unreadChannelIds={unreadChannelIds}
      />

      <div className="flex min-w-0 flex-1 flex-col bg-surface/20">
        <div className="flex items-center gap-2 border-b border-border p-4">
          <Hash size={18} className="shrink-0 text-muted" />
          <h1 className="truncate text-sm font-semibold text-foreground">{activeChannelName}</h1>
          <span className="text-xs text-muted">
            {members.length + 1} member{members.length === 0 ? "" : "s"}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {searchOpen && (
              <input
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="input-field !w-48 !py-1 !text-xs"
              />
            )}
            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                setSearchQuery("");
              }}
              className={`rounded-full p-1.5 transition-colors ${
                searchOpen ? "bg-surface-2 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
              title="Search messages"
            >
              <Search size={15} />
            </button>
          </div>
        </div>

        {pinnedMessage && (
          <button
            onClick={() => scrollToMessage(pinnedMessage.clientId!)}
            className="flex items-center gap-2 border-b border-border bg-accent/5 px-4 py-2 text-left transition-colors hover:bg-accent/10"
          >
            <Pin size={13} className="shrink-0 text-accent-bright" />
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              <span className="font-medium">{pinnedMessage.senderDisplayName}: </span>
              {pinnedMessage.text}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                setPinnedMessage(groupId, null);
              }}
              className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              title="Unpin"
            >
              <X size={13} />
            </span>
          </button>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          {searchedMessages.length === 0 ? (
            searchQuery.trim() ? (
              <p className="text-center text-sm text-muted">No messages match &quot;{searchQuery.trim()}&quot;.</p>
            ) : isBrandNew ? (
              <div className="mx-auto max-w-md py-8 text-center">
                <h2 className="text-2xl font-bold text-foreground">Welcome to</h2>
                <h2 className="mb-4 text-2xl font-bold text-foreground">{groupName}</h2>
                <p className="mb-6 text-sm text-muted">
                  This is your brand new server. Here are a few steps to get things going.
                </p>
                <div className="flex flex-col gap-2 text-left">
                  <button
                    onClick={copyInviteCode}
                    className="card-hover flex items-center gap-3 rounded-xl border border-border bg-surface-2/20 p-3"
                  >
                    <span className="icon-badge h-9 w-9 shrink-0">
                      <UserPlus size={16} />
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">Invite your friends</span>
                    {copiedInvite ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-muted" />}
                  </button>
                  <div className="card-hover flex items-center gap-3 rounded-xl border border-border bg-surface-2/20 p-3">
                    <span className="icon-badge h-9 w-9 shrink-0">
                      <ImagePlus size={16} />
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">
                      Personalize your server with an icon — open the server menu at the top of the channel list
                    </span>
                  </div>
                  <button
                    onClick={() => messageInputRef.current?.focus()}
                    className="card-hover flex items-center gap-3 rounded-xl border border-border bg-surface-2/20 p-3"
                  >
                    <span className="icon-badge h-9 w-9 shrink-0">
                      <MessageSquare size={16} />
                    </span>
                    <span className="flex-1 text-sm font-medium text-foreground">Send your first message</span>
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted">This is the start of #{activeChannelName} — say hi!</p>
            )
          ) : (
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
          )}
        </div>

        <div className="border-t border-border p-3">
          {!isFirebaseConfigured ? (
            <p className="text-center text-xs text-muted">
              Group chat isn&apos;t set up yet — add your Firebase config to <code>.env</code> to send messages.
            </p>
          ) : (
            <>
              {typingNames.length > 0 && (
                <p className="mb-1 px-1 text-xs italic text-muted">
                  {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
                </p>
              )}
              {imagePreview && (
                <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URI preview, not an optimizable remote/static asset */}
                  <img src={imagePreview} alt="Attachment preview" className="h-14 w-14 rounded object-cover" />
                  <span className="flex-1 text-xs text-muted">Image attached</span>
                  <button
                    onClick={() => setImagePreview(null)}
                    className="rounded-full p-1 text-muted hover:bg-surface-2 hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <input ref={attachInputRef} type="file" accept="image/*" onChange={handleFileSelected} className="hidden" />
                <button
                  onClick={() => attachInputRef.current?.click()}
                  disabled={attaching}
                  className="btn-ghost !px-3"
                  title="Attach an image"
                >
                  <ImagePlus size={16} />
                </button>
                <input
                  ref={messageInputRef}
                  value={text}
                  onChange={(e) => handleTextChange(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={`Message #${activeChannelName}`}
                  className="input-field flex-1"
                />
                <button onClick={handleSend} className="btn-primary !px-4">
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>

        {viewingMember && (
          <FriendProfileModal
            code={viewingMember.code}
            fallbackDisplayName={viewingMember.displayName}
            fallbackBadge={viewingMember.badge}
            isSelf={viewingMember.code === myCode}
            serverRole={viewingMember.roleId ? roles.find((r) => r.id === viewingMember.roleId) : null}
            onClose={() => setViewingMember(null)}
          />
        )}

        {msgMenuTarget && (
          <MemberContextMenu
            target={msgMenuTarget}
            groupId={groupId}
            myCode={myCode}
            creatorCode={creatorCode}
            roles={roles}
            onClose={() => setMsgMenuTarget(null)}
            onViewProfile={(member) =>
              setViewingMember({ code: member.code, displayName: member.displayName, badge: member.badge, roleId: member.roleId })
            }
            onMention={insertMention}
            onEditNickname={setEditingNicknameFor}
          />
        )}

        {editingNicknameFor && (
          <NicknameModal
            groupId={groupId}
            myCode={myCode}
            targetCode={editingNicknameFor.code}
            targetDisplayName={editingNicknameFor.displayName}
            tag={tag}
            onClose={() => setEditingNicknameFor(null)}
          />
        )}
      </div>

      <GroupMembersList
        groupId={groupId}
        myCode={myCode}
        creatorCode={creatorCode}
        members={allMembers}
        tag={tag}
        roles={roles}
        onMention={insertMention}
      />
    </div>
  );
}
