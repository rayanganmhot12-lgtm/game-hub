"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Hash,
  Volume2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Camera,
  LogOut,
  UserPlus,
  Settings,
  BellOff,
  Bell,
  X,
  Users,
  Plus,
  Trash2,
  UserCog,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { formatFriendCode } from "@/lib/friendCode";
import { listenToPresence } from "@/lib/presence";
import {
  leaveGroupRoster,
  joinGroupRoster,
  setGroupIcon,
  listenForGroupIcon,
  setGroupName,
  listenForGroupName,
  sendGroupInvite,
  setGroupMuted,
  listenForGroupMuted,
  setGroupProfile,
  listenForGroupProfile,
  listenForGroupCreatedAt,
  listenForGroupChannels,
  listenForGroupCategories,
  createGroupChannel,
  deleteGroupChannel,
  createGroupCategory,
  deleteGroupCategory,
  setGroupTag,
  listenForGroupTag,
  DEFAULT_TEXT_CHANNEL_ID,
  DEFAULT_VOICE_CHANNEL_ID,
  type GroupProfile,
  type GroupChannel,
  type GroupCategory,
  type GroupTag,
  type GroupRole,
  listenForGroupRoles,
  listenForGroupCreator,
  deleteGroupEverywhere,
} from "@/lib/groupRealtime";
import { useGroupCall } from "@/context/GroupCallContext";
import { useCall } from "@/context/CallContext";
import ServerUserPanel from "@/components/ServerUserPanel";
import ProfileAvatar from "@/components/ProfileAvatar";
import {
  BANNER_SWATCHES,
  bannerClassName,
  TAG_BADGES,
  TAG_COLORS,
  TagChip,
  NicknameModal,
  type GroupMemberEntry,
} from "@/components/ServerChips";
import { MembersTab, RolesTab, BansTab, AutoModTab, EmojiTab } from "@/components/ServerModerationTabs";

const SERVER_ICON_SIZE = 128;
const MAX_TRAITS = 5;

export { BANNER_SWATCHES, bannerClassName, TAG_BADGES, TAG_COLORS, tagColorClassName, TagChip, type GroupMemberEntry } from "@/components/ServerChips";

function resizeToDataUrl(file: File, size: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas isn't supported in this browser."));
        return;
      }
      const scale = Math.max(size / img.width, size / img.height);
      const drawWidth = img.width * scale;
      const drawHeight = img.height * scale;
      ctx.drawImage(img, (size - drawWidth) / 2, (size - drawHeight) / 2, drawWidth, drawHeight);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = URL.createObjectURL(file);
  });
}

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
  friendBadge?: string | null;
}

export const DEFAULT_CHANNELS: Array<GroupChannel & { id: string }> = [
  { id: DEFAULT_TEXT_CHANNEL_ID, name: "general", type: "text", categoryId: null, position: 0 },
  { id: DEFAULT_VOICE_CHANNEL_ID, name: "General", type: "voice", categoryId: null, position: 1 },
];

export default function GroupChannelsSidebar({
  groupId,
  groupName,
  myCode,
  myDisplayName,
  myBadge,
  myAvatarDataUrl,
  myEquippedFrame,
  members,
  activeChannelId,
  onSelectChannel,
  unreadChannelIds,
}: {
  groupId: string;
  groupName: string;
  myCode: string;
  myDisplayName: string;
  myBadge?: string | null;
  myAvatarDataUrl?: string | null;
  myEquippedFrame?: string | null;
  members: GroupMemberEntry[];
  activeChannelId: string;
  onSelectChannel: (channelId: string) => void;
  unreadChannelIds?: Set<string>;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { activeGroupCall, joinGroupCall } = useGroupCall();
  const { activeCall } = useCall();
  const [joiningVoice, setJoiningVoice] = useState(false);
  const [liveName, setLiveName] = useState(groupName);
  const [icon, setIcon] = useState<string | null>(null);
  const [profile, setProfile] = useState<GroupProfile>({});
  const [channels, setChannels] = useState<Array<GroupChannel & { id: string }>>([]);
  const [categories, setCategories] = useState<Array<GroupCategory & { id: string }>>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [tag, setTag] = useState<GroupTag | null>(null);
  const [creatorCode, setCreatorCode] = useState<string | null>(null);
  const [panel, setPanel] = useState<"invite" | "settings" | "nickname" | "delete" | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const iconInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return listenForGroupName(groupId, (name) => setLiveName(name ?? groupName));
  }, [groupId, groupName]);

  useEffect(() => {
    return listenForGroupIcon(groupId, setIcon);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupProfile(groupId, setProfile);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupTag(groupId, setTag);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupCreator(groupId, setCreatorCode);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupMuted(groupId, myCode, setMuted);
  }, [groupId, myCode]);

  useEffect(() => {
    return listenForGroupChannels(groupId, setChannels);
  }, [groupId]);

  useEffect(() => {
    return listenForGroupCategories(groupId, setCategories);
  }, [groupId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const displayChannels = channels.length > 0 ? channels : DEFAULT_CHANNELS;
  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.position - b.position), [categories]);
  const uncategorized = displayChannels.filter((c) => !c.categoryId).sort((a, b) => a.position - b.position);

  function toggleCollapsed(categoryId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function copyInvite() {
    navigator.clipboard.writeText(formatFriendCode(groupId));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleIconPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Pick an image file.", "error");
      return;
    }
    try {
      const dataUrl = await resizeToDataUrl(file, SERVER_ICON_SIZE);
      await setGroupIcon(groupId, dataUrl);
      showToast("Server icon updated.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save icon.", "error");
    } finally {
      if (iconInputRef.current) iconInputRef.current.value = "";
    }
  }

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    await setGroupMuted(groupId, myCode, next);
    showToast(next ? "Server muted." : "Server unmuted.", "success");
  }

  async function leaveServer() {
    try {
      await leaveGroupRoster(groupId, myCode);
      await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
    } catch {
      // best-effort — still navigate away
    }
    router.push("/friends");
    router.refresh();
  }

  async function handleJoinVoice() {
    if (activeGroupCall) return;
    // A 1:1 call and a group call can't run at once — CallWindow renders only
    // one mode, and group calls win, which would leave the friend call with no
    // tile, no audio sink and no hang-up button. joinGroupCall() refuses this
    // too; checking here just gets the message out without the round-trip.
    if (activeCall) {
      showToast("You're already in a call — hang up first to join a voice channel.", "error");
      return;
    }
    setJoiningVoice(true);
    try {
      await joinGroupCall(groupId, liveName);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't join voice.", "error");
    } finally {
      setJoiningVoice(false);
    }
  }

  function renderChannelRow(channel: GroupChannel & { id: string }) {
    const active = channel.type === "text" && channel.id === activeChannelId;
    if (channel.type === "voice") {
      const connectedHere = activeGroupCall?.groupId === groupId;
      const inOtherCall = Boolean(activeGroupCall) && !connectedHere;
      return (
        <button
          key={channel.id}
          type="button"
          onClick={handleJoinVoice}
          disabled={joiningVoice || connectedHere || inOtherCall}
          title={inOtherCall ? "Leave your current voice call first" : connectedHere ? "You're connected" : "Join voice"}
          className={`flex w-full items-center gap-1.5 rounded-lg py-1.5 pl-3 pr-2 text-left text-sm transition-colors disabled:cursor-default ${
            connectedHere
              ? "bg-accent/15 text-accent-bright"
              : "text-muted hover:bg-surface-2/40 hover:text-foreground disabled:hover:bg-transparent"
          }`}
        >
          <Volume2 size={16} className="shrink-0" />
          <span className="flex-1 truncate">{channel.name}</span>
          {connectedHere && <span className="text-[10px] font-semibold uppercase tracking-wide">Connected</span>}
        </button>
      );
    }
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
  }

  return (
    <div className="flex h-full w-60 shrink-0 flex-col border-r border-border/60 bg-surface/40">
      <div
        ref={menuRef}
        className={`relative border-b border-border/60 p-3 ${bannerClassName(profile.banner)}`}
      >
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center justify-between rounded-lg bg-black/10 px-2 py-1.5 text-sm font-semibold text-foreground backdrop-blur-sm transition-colors hover:bg-black/20"
        >
          <span className="truncate">{liveName}</span>
          <ChevronDown size={15} className={`shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
        </button>

        {menuOpen && (
          <div className="absolute left-3 right-3 top-full z-20 mt-1 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg">
            <button
              onClick={() => {
                setPanel("invite");
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              <UserPlus size={13} />
              Invite People
            </button>
            <button
              onClick={() => {
                setPanel("settings");
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              <Settings size={13} />
              Server Settings
            </button>
            <button
              onClick={() => {
                setPanel("nickname");
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              <UserCog size={13} />
              Nickname
            </button>
            <button
              onClick={toggleMute}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-2"
            >
              {muted ? <BellOff size={13} /> : <Bell size={13} />}
              {muted ? "Unmute Server" : "Mute Server"}
            </button>
            <div className="my-1 border-t border-border/60" />
            <button
              onClick={leaveServer}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-surface-2"
            >
              <LogOut size={13} />
              Leave Server
            </button>
            {creatorCode === myCode && (
              <button
                onClick={() => {
                  setPanel("delete");
                  setMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 transition-colors hover:bg-surface-2"
              >
                <Trash2 size={13} />
                Delete Server
              </button>
            )}
          </div>
        )}
        <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconPick} className="hidden" />
      </div>

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

      <ServerUserPanel
        myCode={myCode}
        myDisplayName={myDisplayName}
        avatarDataUrl={myAvatarDataUrl}
        equippedFrame={myEquippedFrame}
        equippedBadge={myBadge}
      />

      {panel === "invite" && (
        <InvitePanel
          groupId={groupId}
          groupName={liveName}
          myCode={myCode}
          myDisplayName={myDisplayName}
          myBadge={myBadge}
          copied={copied}
          onCopy={copyInvite}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "settings" && (
        <SettingsPanel
          groupId={groupId}
          currentName={liveName}
          icon={icon}
          profile={profile}
          tag={tag}
          members={members}
          myCode={myCode}
          categories={sortedCategories}
          channels={displayChannels}
          onChangeIcon={() => iconInputRef.current?.click()}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === "nickname" && (
        <NicknameModal groupId={groupId} myCode={myCode} tag={tag} onClose={() => setPanel(null)} />
      )}

      {panel === "delete" && (
        <DeleteServerModal groupId={groupId} groupName={liveName} onClose={() => setPanel(null)} />
      )}
    </div>
  );
}

function DeleteServerModal({
  groupId,
  groupName,
  onClose,
}: {
  groupId: string;
  groupName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await deleteGroupEverywhere(groupId);
      await fetch(`/api/groups/${groupId}`, { method: "DELETE" });
      showToast(`"${groupName}" deleted.`, "success");
      router.push("/friends");
      router.refresh();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete server.", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="panel relative w-full max-w-xs !p-5"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={16} />
          </button>
          <h2 className="mb-1 text-sm font-semibold text-red-400">Delete {groupName}?</h2>
          <p className="mb-3 text-xs text-muted">
            This removes the server for every member, permanently. This can&apos;t be undone.
          </p>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
            Type the server name to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={groupName}
            className="input-field mb-4 w-full"
          />
          <button
            onClick={confirmDelete}
            disabled={deleting || confirmText !== groupName}
            className="btn-primary w-full !bg-red-500 disabled:opacity-50"
          >
            Delete Server
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function InvitePanel({
  groupId,
  groupName,
  myCode,
  myDisplayName,
  myBadge,
  copied,
  onCopy,
  onClose,
}: {
  groupId: string;
  groupName: string;
  myCode: string;
  myDisplayName: string;
  myBadge?: string | null;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/friends")
      .then((res) => res.json())
      .then((data) => setFriends(data.friends ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function invite(friend: Friend) {
    try {
      await joinGroupRoster(groupId, friend.friendCode, friend.friendDisplayName, friend.friendBadge);
      await sendGroupInvite(friend.friendCode, groupId, groupName, myCode, myDisplayName);
      await fetch(`/api/groups/${groupId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberCode: friend.friendCode,
          memberDisplayName: friend.friendDisplayName,
          memberBadge: friend.friendBadge,
        }),
      });
      setInvited((prev) => new Set(prev).add(friend.friendCode));
      showToast(`Invited ${friend.friendDisplayName}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't invite them.", "error");
    }
    void myBadge;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 px-4"
      >
        <motion.div
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.94, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="panel relative w-full max-w-sm !p-5"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={16} />
          </button>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Invite People to {groupName}</h2>

          <button
            onClick={onCopy}
            className="mb-4 flex w-full items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface-2"
          >
            <span>
              Invite Code: <span className="font-mono text-accent-bright">{formatFriendCode(groupId)}</span>
            </span>
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>

          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your Friends</p>
          {loading ? (
            <p className="text-xs text-muted">Loading…</p>
          ) : friends.length === 0 ? (
            <p className="text-xs text-muted">Add some friends first, or share the invite code above.</p>
          ) : (
            <div className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {friends.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-2/40">
                  <span className="flex items-center gap-2 text-sm text-foreground">
                    <ProfileAvatar code={f.friendCode} displayName={f.friendDisplayName} size={24} />
                    {f.friendDisplayName}
                  </span>
                  <button
                    onClick={() => invite(f)}
                    disabled={invited.has(f.friendCode)}
                    className="btn-ghost !px-2.5 !py-1 !text-xs disabled:opacity-50"
                  >
                    {invited.has(f.friendCode) ? <Check size={13} /> : "Invite"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ServerPreviewCard({
  name,
  icon,
  banner,
  members,
  createdAt,
}: {
  name: string;
  icon: string | null;
  banner?: string | null;
  members: GroupMemberEntry[];
  createdAt: number | null;
}) {
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const unsubs = members.map((m) =>
      listenToPresence(m.code, (state) => setOnlineMap((prev) => ({ ...prev, [m.code]: Boolean(state?.online) })))
    );
    return () => unsubs.forEach((u) => u());
  }, [members]);

  const onlineCount = members.filter((m) => onlineMap[m.code]).length;
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-2/30">
      <div className={`relative h-16 w-full ${bannerClassName(banner)}`}>
        <div className="absolute -bottom-5 left-3">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img src={icon} alt="" className="h-11 w-11 rounded-2xl object-cover ring-4 ring-surface" />
          ) : (
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black text-sm font-bold text-white ring-4 ring-surface">
              {initial}
            </span>
          )}
        </div>
      </div>
      <div className="px-3 pb-3 pt-7">
        <p className="truncate text-sm font-bold text-foreground">{name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            {onlineCount} Online
          </span>
          <span className="flex items-center gap-1">
            <Users size={11} />
            {members.length} Member{members.length === 1 ? "" : "s"}
          </span>
        </div>
        {createdAt && (
          <p className="mt-1 text-[11px] text-muted">
            Est. {new Date(createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short" })}
          </p>
        )}
      </div>
    </div>
  );
}

function ChannelRow({ channel, onRemove }: { channel: GroupChannel & { id: string }; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2/40">
      {channel.type === "text" ? <Hash size={14} className="text-muted" /> : <Volume2 size={14} className="text-muted" />}
      <span className="flex-1 truncate text-foreground">{channel.name}</span>
      <button onClick={onRemove} className="text-muted hover:text-red-400">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function AddChannelForm({
  channelName,
  onChangeName,
  channelType,
  onChangeType,
  busy,
  onAdd,
}: {
  channelName: string;
  onChangeName: (v: string) => void;
  channelType: "text" | "voice";
  onChangeType: (v: "text" | "voice") => void;
  busy: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-border bg-surface-2/30 p-1.5">
      <input
        value={channelName}
        onChange={(e) => onChangeName(e.target.value)}
        placeholder="channel-name"
        className="input-field !py-1 !text-xs flex-1"
      />
      <select
        value={channelType}
        onChange={(e) => onChangeType(e.target.value as "text" | "voice")}
        className="input-field !w-20 !py-1 !text-xs"
      >
        <option value="text">Text</option>
        <option value="voice">Voice</option>
      </select>
      <button onClick={onAdd} disabled={busy} className="btn-primary !px-2 !py-1 !text-xs">
        Add
      </button>
    </div>
  );
}

function ChannelsTab({
  groupId,
  categories,
  channels,
}: {
  groupId: string;
  categories: Array<GroupCategory & { id: string }>;
  channels: Array<GroupChannel & { id: string }>;
}) {
  const { showToast } = useToast();
  const [addingCategory, setAddingCategory] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [addingChannelFor, setAddingChannelFor] = useState<string | "none" | null>(null);
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState<"text" | "voice">("text");
  const [busy, setBusy] = useState(false);

  async function addCategory() {
    const trimmed = categoryName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createGroupCategory(groupId, trimmed);
      setCategoryName("");
      setAddingCategory(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create category.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function addChannel(categoryId: string | null) {
    const trimmed = channelName.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createGroupChannel(groupId, trimmed, channelType, categoryId);
      setChannelName("");
      setAddingChannelFor(null);
      setChannelType("text");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create channel.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeChannel(channelId: string) {
    try {
      await deleteGroupChannel(groupId, channelId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete channel.", "error");
    }
  }

  async function removeCategory(categoryId: string) {
    try {
      await deleteGroupCategory(groupId, categoryId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete category.", "error");
    }
  }

  const uncategorized = channels.filter((c) => !c.categoryId);

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <h2 className="mb-4 text-sm font-semibold text-foreground">Channels</h2>

      <div className="mb-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Uncategorized</p>
        <div className="flex flex-col gap-0.5">
          {uncategorized.map((c) => (
            <ChannelRow key={c.id} channel={c} onRemove={() => removeChannel(c.id)} />
          ))}
        </div>
        {addingChannelFor === "none" ? (
          <AddChannelForm
            channelName={channelName}
            onChangeName={setChannelName}
            channelType={channelType}
            onChangeType={setChannelType}
            busy={busy}
            onAdd={() => addChannel(null)}
          />
        ) : (
          <button
            onClick={() => setAddingChannelFor("none")}
            className="mt-1 flex items-center gap-1 text-xs text-muted hover:text-foreground"
          >
            <Plus size={13} /> Add Channel
          </button>
        )}
      </div>

      {categories.map((cat) => {
        const catChannels = channels.filter((c) => c.categoryId === cat.id);
        return (
          <div key={cat.id} className="mb-4">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{cat.name}</p>
              <button onClick={() => removeCategory(cat.id)} className="text-muted hover:text-red-400">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex flex-col gap-0.5">
              {catChannels.map((c) => (
                <ChannelRow key={c.id} channel={c} onRemove={() => removeChannel(c.id)} />
              ))}
            </div>
            {addingChannelFor === cat.id ? (
              <AddChannelForm
                channelName={channelName}
                onChangeName={setChannelName}
                channelType={channelType}
                onChangeType={setChannelType}
                busy={busy}
                onAdd={() => addChannel(cat.id)}
              />
            ) : (
              <button
                onClick={() => setAddingChannelFor(cat.id)}
                className="mt-1 flex items-center gap-1 text-xs text-muted hover:text-foreground"
              >
                <Plus size={13} /> Add Channel
              </button>
            )}
          </div>
        );
      })}

      {addingCategory ? (
        <div className="flex items-center gap-1.5">
          <input
            value={categoryName}
            onChange={(e) => setCategoryName(e.target.value)}
            placeholder="Category name"
            className="input-field !py-1.5 !text-xs flex-1"
          />
          <button onClick={addCategory} disabled={busy} className="btn-primary !px-3 !py-1.5 !text-xs">
            Add
          </button>
        </div>
      ) : (
        <button
          onClick={() => setAddingCategory(true)}
          className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted hover:text-foreground"
        >
          <Plus size={13} /> Add Category
        </button>
      )}
    </div>
  );
}

function TagTab({ groupId, tag }: { groupId: string; tag: GroupTag | null }) {
  const { showToast } = useToast();
  const [name, setName] = useState(tag?.name ?? "");
  const [badge, setBadge] = useState(tag?.badge ?? TAG_BADGES[0]);
  const [color, setColor] = useState(tag?.color ?? TAG_COLORS[0].id);
  const [saving, setSaving] = useState(false);

  async function save() {
    const trimmed = name.trim().toUpperCase().slice(0, 4);
    if (!trimmed) {
      showToast("Enter a tag name.", "error");
      return;
    }
    setSaving(true);
    try {
      await setGroupTag(groupId, { name: trimmed, badge, color });
      showToast("Server Tag saved.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save tag.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <h2 className="mb-1 text-sm font-semibold text-foreground">Server Tag</h2>
      <p className="mb-4 text-xs text-muted">
        A short tag members can show next to their name in this server, from the Nickname menu.
      </p>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Choose Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase())}
        placeholder="TAG"
        className="input-field mb-1 w-full font-mono uppercase tracking-widest"
      />
      <p className="mb-4 text-[11px] text-muted">Up to 4 characters, letters and numbers only.</p>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Choose Badge</label>
      <div className="mb-4 grid grid-cols-5 gap-2">
        {TAG_BADGES.map((b) => (
          <button
            key={b}
            onClick={() => setBadge(b)}
            className={`flex h-10 items-center justify-center rounded-lg border text-lg transition-colors ${
              badge === b ? "border-accent-bright bg-accent/10" : "border-border bg-surface-2/40"
            }`}
          >
            {b}
          </button>
        ))}
      </div>

      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Choose Color</label>
      <div className="mb-4 flex flex-wrap gap-2">
        {TAG_COLORS.map((c) => (
          <button
            key={c.id}
            onClick={() => setColor(c.id)}
            title={c.id}
            className={`h-8 w-8 rounded-full border-2 ${c.className} ${color === c.id ? "ring-2 ring-accent-bright ring-offset-2 ring-offset-surface" : ""}`}
          />
        ))}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full">
        Save Tag
      </button>
    </div>
  );
}

function TagPreview({ tag }: { tag: GroupTag | null }) {
  if (!tag) {
    return <p className="text-xs text-muted">Set a name, badge, and color to see a preview.</p>;
  }
  const examples = [
    { name: "Roka", text: "anyone down for a game?" },
    { name: "sharon", text: "count me in" },
  ];
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2/30 p-3">
      {examples.map((ex, i) => (
        <div key={i} className="text-xs">
          <span className="font-semibold text-foreground">{ex.name}</span>{" "}
          {i === 0 && (
            <>
              <TagChip tag={tag} /> <span className="text-muted">check out my tag!</span>
            </>
          )}
          {i !== 0 && <span className="text-muted">{ex.text}</span>}
        </div>
      ))}
    </div>
  );
}

function SettingsPanel({
  groupId,
  currentName,
  icon,
  profile,
  tag,
  members,
  myCode,
  categories,
  channels,
  onChangeIcon,
  onClose,
}: {
  groupId: string;
  currentName: string;
  icon: string | null;
  profile: GroupProfile;
  tag: GroupTag | null;
  members: GroupMemberEntry[];
  myCode: string;
  categories: Array<GroupCategory & { id: string }>;
  channels: Array<GroupChannel & { id: string }>;
  onChangeIcon: () => void;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [section, setSection] = useState<"profile" | "tag" | "channels" | "members" | "roles" | "bans" | "automod" | "emoji">(
    "profile"
  );
  const [roles, setRoles] = useState<Array<GroupRole & { id: string }>>([]);

  useEffect(() => {
    return listenForGroupRoles(groupId, setRoles);
  }, [groupId]);
  const [name, setName] = useState(currentName);
  const [banner, setBanner] = useState(profile.banner ?? "none");
  const [description, setDescription] = useState(profile.description ?? "");
  const [traits, setTraits] = useState<string[]>(() => {
    const t = profile.traits ?? [];
    return [...t, ...Array(MAX_TRAITS - t.length).fill("")].slice(0, MAX_TRAITS);
  });
  const [createdAt, setCreatedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return listenForGroupCreatedAt(groupId, setCreatedAt);
  }, [groupId]);

  function updateTrait(index: number, value: string) {
    setTraits((prev) => prev.map((t, i) => (i === index ? value.slice(0, 30) : t)));
  }

  async function save() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast("Server name can't be empty.", "error");
      return;
    }
    setSaving(true);
    try {
      await setGroupName(groupId, trimmed);
      await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      await setGroupProfile(groupId, {
        banner,
        description: description.trim().slice(0, 300),
        traits: traits.map((t) => t.trim()).filter(Boolean),
      });
      showToast("Server updated.", "success");
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save changes.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[95] flex flex-col bg-background"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <X size={18} />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="mx-auto grid w-full min-h-0 max-w-5xl flex-1 grid-cols-1 gap-6 overflow-hidden p-6 sm:grid-cols-[160px_1fr_220px]"
        >
          <div className="flex flex-row gap-1 overflow-x-auto border-b border-border pb-3 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r sm:pb-0 sm:pr-3">
            {(
              [
                ["profile", "Profile"],
                ["tag", "Server Tag"],
                ["channels", "Channels"],
                ["members", "Members"],
                ["roles", "Roles"],
                ["bans", "Bans"],
                ["automod", "AutoMod"],
                ["emoji", "Emoji"],
              ] as [typeof section, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setSection(value)}
                className={`rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                  section === value ? "bg-accent text-black" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 overflow-y-auto pr-1">
          {section === "profile" ? (
            <div>
              <h2 className="mb-4 text-sm font-semibold text-foreground">Server Profile</h2>

              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Server Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} className="input-field mb-4 w-full" />

              <button onClick={onChangeIcon} className="btn-ghost mb-4 w-full !justify-start gap-2">
                <Camera size={14} />
                Change Server Icon
              </button>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Banner</label>
              <div className="mb-4 grid grid-cols-5 gap-2">
                {BANNER_SWATCHES.map((swatch) => (
                  <button
                    key={swatch.id}
                    onClick={() => setBanner(swatch.id)}
                    title={swatch.id}
                    className={`h-9 rounded-lg ${swatch.className} ${
                      banner === swatch.id ? "ring-2 ring-accent-bright ring-offset-2 ring-offset-surface" : ""
                    }`}
                  />
                ))}
              </div>

              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
                Traits — up to {MAX_TRAITS}
              </label>
              <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {traits.map((t, i) => (
                  <input
                    key={i}
                    value={t}
                    onChange={(e) => updateTrait(i, e.target.value)}
                    placeholder="e.g. Cozy"
                    className="input-field !py-1.5 !text-xs"
                  />
                ))}
              </div>

              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, 300))}
                placeholder="How did your server get started? Why should people join?"
                rows={3}
                className="input-field mb-4 w-full resize-none"
              />

              <button onClick={save} disabled={saving} className="btn-primary w-full">
                Save Changes
              </button>
            </div>
          ) : section === "tag" ? (
            <TagTab groupId={groupId} tag={tag} />
          ) : section === "channels" ? (
            <ChannelsTab groupId={groupId} categories={categories} channels={channels} />
          ) : section === "members" ? (
            <MembersTab groupId={groupId} members={members} roles={roles} myCode={myCode} />
          ) : section === "roles" ? (
            <RolesTab groupId={groupId} roles={roles} />
          ) : section === "bans" ? (
            <BansTab groupId={groupId} />
          ) : section === "automod" ? (
            <AutoModTab groupId={groupId} />
          ) : (
            <EmojiTab groupId={groupId} />
          )}
          </div>

          <div className="hidden overflow-y-auto sm:block">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Preview</p>
            {section === "tag" ? (
              <TagPreview tag={tag} />
            ) : (
              <ServerPreviewCard name={name || currentName} icon={icon} banner={banner} members={members} createdAt={createdAt} />
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
