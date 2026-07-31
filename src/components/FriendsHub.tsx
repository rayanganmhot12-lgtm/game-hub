"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy,
  Check,
  UserPlus,
  MessageCircle,
  Phone,
  X,
  Users,
  Search,
  Plus,
  LogOut,
  Radio,
} from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { useCall } from "@/context/CallContext";
import { CosmeticBadge } from "@/components/CosmeticFrame";
import Avatar from "@/components/Avatar";
import EmptyState from "@/components/EmptyState";
import FriendProfileModal from "@/components/FriendProfileModal";
import CreateServerModal from "@/components/CreateServerModal";
import { isFirebaseConfigured } from "@/lib/firebase";
import { formatFriendCode, normalizeFriendCode } from "@/lib/friendCode";
import { listenToPresence } from "@/lib/presence";
import {
  sendFriendRequest,
  listenForFriendRequests,
  removeFriendRequest,
  sendFriendAccept,
  listenForFriendAccepts,
  removeFriendAccept,
  type FriendRequestPayload,
  type FriendAcceptPayload,
} from "@/lib/friendRealtime";
import {
  listenForGroupInvites,
  removeGroupInvite,
  joinGroupRoster,
  leaveGroupRoster,
  listenForGroupIcon,
  type GroupInvitePayload,
} from "@/lib/groupRealtime";
import { logNotification } from "@/lib/notifications";

function GroupIcon({ groupId }: { groupId: string }) {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return listenForGroupIcon(groupId, setIcon);
  }, [groupId]);

  if (icon) {
    // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
    return <img src={icon} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className="icon-badge h-10 w-10 shrink-0">
      <Users size={16} />
    </span>
  );
}

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
  friendBadge?: string | null;
  addedAt?: string | Date;
}

interface GroupMember {
  id: string;
  memberCode: string;
  memberDisplayName: string;
  memberBadge?: string | null;
}

interface Group {
  id: string;
  groupId: string;
  name: string;
  members: GroupMember[];
}

type Tab = "online" | "all" | "add";

export default function FriendsHub({
  myCode,
  myDisplayName,
  myBadge,
  initialFriends,
  initialGroups,
}: {
  myCode: string;
  myDisplayName: string;
  myBadge?: string | null;
  initialFriends: Friend[];
  initialGroups: Group[];
}) {
  const { showToast } = useToast();
  const { startCall, activeCall, incomingCall } = useCall();

  const [friends, setFriends] = useState(initialFriends);
  const [groups, setGroups] = useState(initialGroups);
  const [requests, setRequests] = useState<Array<FriendRequestPayload & { id: string }>>([]);
  const [invites, setInvites] = useState<Array<GroupInvitePayload & { id: string }>>([]);

  const [tab, setTab] = useState<Tab>("online");
  const [search, setSearch] = useState("");
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});

  const [codeInput, setCodeInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [sending, setSending] = useState(false);

  const [showServerModal, setShowServerModal] = useState(false);

  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);

  const seenRequestIds = useRef(new Set<string>());
  const seenInviteIds = useRef(new Set<string>());

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubRequests = listenForFriendRequests(myCode, (incoming) => {
      for (const req of incoming) {
        if (!seenRequestIds.current.has(req.id)) {
          seenRequestIds.current.add(req.id);
          logNotification("friend_request", `${req.fromDisplayName} sent you a friend request.`);
        }
      }
      setRequests(incoming);
    });

    const unsubAccepts = listenForFriendAccepts(myCode, async (accepts: Array<FriendAcceptPayload & { id: string }>) => {
      for (const accept of accepts) {
        const res = await fetch("/api/friends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            friendCode: accept.byCode,
            friendDisplayName: accept.byDisplayName,
            friendBadge: accept.byBadge,
          }),
        });
        if (res.ok) {
          const { friend } = await res.json();
          setFriends((prev) => [...prev.filter((f) => f.friendCode !== friend.friendCode), friend]);
          showToast(`${accept.byDisplayName} accepted your friend request!`, "success");
          logNotification("friend_accept", `${accept.byDisplayName} accepted your friend request.`);
        }
        await removeFriendAccept(myCode, accept.id);
      }
    });

    const unsubInvites = listenForGroupInvites(myCode, (incoming) => {
      for (const inv of incoming) {
        if (!seenInviteIds.current.has(inv.id)) {
          seenInviteIds.current.add(inv.id);
          logNotification("group_invite", `${inv.fromDisplayName} invited you to "${inv.groupName}".`);
        }
      }
      setInvites(incoming);
    });

    return () => {
      unsubRequests();
      unsubAccepts();
      unsubInvites();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubs = friends.map((f) =>
      listenToPresence(f.friendCode, (state) =>
        setOnlineMap((prev) => ({ ...prev, [f.friendCode]: Boolean(state?.online) }))
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [friends]);

  function copyCode() {
    navigator.clipboard.writeText(formatFriendCode(myCode));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function addFriend() {
    const targetCode = normalizeFriendCode(codeInput);
    if (targetCode.length < 6) {
      showToast("Enter a valid friend code.", "error");
      return;
    }
    if (targetCode === myCode) {
      showToast("You can't add yourself.", "error");
      return;
    }
    setSending(true);
    try {
      await sendFriendRequest(targetCode, myCode, myDisplayName, myBadge);
      showToast("Friend request sent.", "success");
      setCodeInput("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send request.", "error");
    } finally {
      setSending(false);
    }
  }

  async function acceptRequest(request: FriendRequestPayload & { id: string }) {
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          friendCode: request.fromCode,
          friendDisplayName: request.fromDisplayName,
          friendBadge: request.fromBadge,
        }),
      });
      if (res.ok) {
        const { friend } = await res.json();
        setFriends((prev) => [...prev.filter((f) => f.friendCode !== friend.friendCode), friend]);
        await sendFriendAccept(request.fromCode, myCode, myDisplayName, myBadge);
        showToast(`You're now friends with ${request.fromDisplayName}.`, "success");
      }
      await removeFriendRequest(myCode, request.id);
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't accept request.", "error");
    }
  }

  async function declineRequest(request: FriendRequestPayload & { id: string }) {
    try {
      await removeFriendRequest(myCode, request.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't decline request.", "error");
    } finally {
      setRequests((prev) => prev.filter((r) => r.id !== request.id));
    }
  }

  async function removeFriend(friend: Friend) {
    try {
      await fetch(`/api/friends/${friend.friendCode}`, { method: "DELETE" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't remove friend.", "error");
      return;
    }
    setFriends((prev) => prev.filter((f) => f.id !== friend.id));
  }

  async function callFriend(friend: Friend) {
    if (!isFirebaseConfigured) {
      showToast("Voice calls aren't set up yet — see the README for Firebase setup.", "error");
      return;
    }
    if (activeCall || incomingCall) {
      showToast("You're already in a call.", "error");
      return;
    }
    try {
      await startCall(friend.friendCode, friend.friendDisplayName);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't start call.", "error");
    }
  }

  async function refreshGroups() {
    const res = await fetch("/api/groups");
    if (res.ok) {
      const { groups: fresh } = await res.json();
      setGroups(fresh);
    }
  }

  async function acceptInvite(invite: GroupInvitePayload & { id: string }) {
    try {
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: invite.groupId, name: invite.groupName }),
      });
      if (res.ok) {
        await joinGroupRoster(invite.groupId, myCode, myDisplayName, myBadge);
        await refreshGroups();
        showToast(`Joined ${invite.groupName}.`, "success");
      }
      await removeGroupInvite(myCode, invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't join group.", "error");
    }
  }

  async function declineInvite(invite: GroupInvitePayload & { id: string }) {
    try {
      await removeGroupInvite(myCode, invite.id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't decline invite.", "error");
    } finally {
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    }
  }

  async function leaveGroup(group: Group) {
    try {
      await leaveGroupRoster(group.groupId, myCode);
      await fetch(`/api/groups/${group.groupId}`, { method: "DELETE" });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't leave group.", "error");
      return;
    }
    setGroups((prev) => prev.filter((g) => g.id !== group.id));
  }

  const onlineFriends = useMemo(() => friends.filter((f) => onlineMap[f.friendCode]), [friends, onlineMap]);

  const visibleFriends = useMemo(() => {
    const base = tab === "online" ? onlineFriends : friends;
    const q = search.trim().toLowerCase();
    return q ? base.filter((f) => f.friendDisplayName.toLowerCase().includes(q)) : base;
  }, [tab, friends, onlineFriends, search]);

  const visibleGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? groups.filter((g) => g.name.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  const sortedFriends = useMemo(
    () => [...visibleFriends].sort((a, b) => a.friendDisplayName.localeCompare(b.friendDisplayName)),
    [visibleFriends]
  );
  const sortedGroups = useMemo(
    () => [...visibleGroups].sort((a, b) => a.name.localeCompare(b.name)),
    [visibleGroups]
  );

  const isEmptyList = sortedFriends.length === 0 && sortedGroups.length === 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="panel p-5">
        <h2 className="mb-2 text-sm font-semibold text-foreground">Your Friend Code</h2>
        <div className="flex items-center gap-2">
          <code className="rounded-lg border border-border bg-surface-2/60 px-4 py-2 text-lg tracking-widest text-accent-bright">
            {formatFriendCode(myCode)}
          </code>
          <button onClick={copyCode} className="btn-ghost" title="Copy code">
            {copied ? <Check size={15} /> : <Copy size={15} />}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Share this with a friend so they can add you.</p>
      </div>

      {!isFirebaseConfigured && (
        <div className="panel p-6 text-center">
          <p className="text-sm text-muted">
            Friends and groups need a free Firebase project to relay requests/messages between installations. Add
            your config to <code className="text-accent-bright">.env</code> — see the README for setup steps.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-1 rounded-lg border border-border bg-surface-2/40 p-1">
              {(
                [
                  ["online", "Online"],
                  ["all", "All"],
                  ["add", "Add Friend"],
                ] as [Tab, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTab(value)}
                  className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === value ? "bg-accent text-black" : "text-muted hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab !== "add" && (
              <button
                onClick={() => setShowServerModal(true)}
                className="btn-ghost !px-3 !py-1.5 !text-xs"
                title="Create or join a server"
              >
                <Plus size={14} />
                New Server
              </button>
            )}
          </div>

          <AnimatePresence>
            {requests.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="panel p-5"
              >
                <h2 className="mb-3 text-sm font-semibold text-foreground">Friend Requests</h2>
                <div className="flex flex-col gap-2">
                  {requests.map((req, i) => (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="card-hover flex items-center justify-between rounded-xl border border-border bg-surface-2/20 p-3"
                    >
                      <span className="flex items-center gap-2.5 text-sm text-foreground">
                        <Avatar name={req.fromDisplayName} />
                        {req.fromDisplayName}
                        <CosmeticBadge badgeId={req.fromBadge} />
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => acceptRequest(req)} className="btn-primary !px-3 !py-1.5 !text-xs">
                          Accept
                        </button>
                        <button onClick={() => declineRequest(req)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                          <X size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {invites.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="panel p-5"
              >
                <h2 className="mb-3 text-sm font-semibold text-foreground">Group Invites</h2>
                <div className="flex flex-col gap-2">
                  {invites.map((inv, i) => (
                    <motion.div
                      key={inv.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="card-hover flex items-center justify-between rounded-xl border border-border bg-surface-2/20 p-3"
                    >
                      <span className="flex items-center gap-2.5 text-sm text-foreground">
                        <span className="icon-badge h-9 w-9 shrink-0">
                          <Users size={16} />
                        </span>
                        <span>
                          <span className="font-semibold">{inv.groupName}</span>
                          <br />
                          <span className="text-xs text-muted">invited by {inv.fromDisplayName}</span>
                        </span>
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => acceptInvite(inv)} className="btn-primary !px-3 !py-1.5 !text-xs">
                          Accept
                        </button>
                        <button onClick={() => declineInvite(inv)} className="btn-ghost !px-3 !py-1.5 !text-xs">
                          <X size={13} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {tab === "add" ? (
            <div className="panel p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserPlus size={16} className="text-accent-bright" />
                Add a Friend
              </h2>
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addFriend()}
                  placeholder="XXXX-XXXX"
                  className="input-field flex-1"
                  disabled={!isFirebaseConfigured}
                />
                <button onClick={addFriend} disabled={sending || !isFirebaseConfigured} className="btn-primary">
                  Send Request
                </button>
              </div>
            </div>
          ) : (
            <div className="panel p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Users size={16} className="text-accent-bright" />
                  {tab === "online" ? "Online" : "All Friends"}
                </h2>
                <div className="relative w-40 sm:w-56">
                  <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search"
                    className="input-field w-full !py-1.5 !pl-8 !text-xs"
                  />
                </div>
              </div>

              {isEmptyList ? (
                <EmptyState icon={Users} title={tab === "online" ? "No one's online right now" : "No friends yet"}>
                  {tab === "online" ? "Check the All tab, or invite someone new." : "Add a friend by code to get started."}
                </EmptyState>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedFriends.map((friend, i) => (
                    <motion.div
                      key={friend.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="card-hover flex items-center justify-between rounded-xl border border-border bg-surface-2/20 p-3"
                    >
                      <button
                        onClick={() => setViewingFriend(friend)}
                        className="flex min-w-0 items-center gap-2.5 rounded-lg text-left transition-opacity hover:opacity-80"
                        title="View profile"
                      >
                        <div className="relative shrink-0">
                          <Avatar name={friend.friendDisplayName} size={40} />
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 block h-3 w-3 rounded-full ring-2 ring-surface ${
                              onlineMap[friend.friendCode] ? "bg-emerald-400" : "bg-surface-2"
                            }`}
                          />
                        </div>
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-medium text-foreground">{friend.friendDisplayName}</span>
                            <CosmeticBadge badgeId={friend.friendBadge} />
                          </span>
                          <span className="text-xs text-muted">{onlineMap[friend.friendCode] ? "Online" : "Offline"}</span>
                        </span>
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        <button onClick={() => callFriend(friend)} className="btn-ghost !px-2.5 !py-1.5" title="Voice call">
                          <Phone size={14} />
                        </button>
                        <Link href={`/chat/${friend.friendCode}`} className="btn-ghost !px-2.5 !py-1.5" title="Chat">
                          <MessageCircle size={14} />
                        </Link>
                        <button
                          onClick={() => removeFriend(friend)}
                          className="btn-ghost !px-2 !py-1.5"
                          title="Remove friend"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}

                  {sortedGroups.map((g, i) => (
                    <Link
                      key={g.id}
                      href={`/groups/${g.groupId}`}
                      className="card-hover flex items-center justify-between rounded-xl border border-border bg-surface-2/20 p-3"
                    >
                      <motion.span
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (sortedFriends.length + i) * 0.03 }}
                        className="flex min-w-0 items-center gap-2.5"
                      >
                        <GroupIcon groupId={g.groupId} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{g.name}</span>
                          <span className="text-xs text-muted">
                            {g.members.length} member{g.members.length === 1 ? "" : "s"}
                          </span>
                        </span>
                      </motion.span>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          leaveGroup(g);
                        }}
                        className="btn-ghost !px-2 !py-1.5 shrink-0"
                        title="Leave group"
                      >
                        <LogOut size={14} />
                      </button>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="panel sticky top-20 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
              <Radio size={13} className="text-emerald-400" />
              Active Now
            </h2>
            {onlineFriends.length === 0 ? (
              <p className="text-xs text-muted">It&apos;s quiet for now — no friends online.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {onlineFriends.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setViewingFriend(f)}
                    className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-80"
                  >
                    <div className="relative shrink-0">
                      <Avatar name={f.friendDisplayName} size={32} />
                      <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-surface" />
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium text-foreground">{f.friendDisplayName}</span>
                      <span className="text-[11px] text-muted">Online</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>

      {viewingFriend && (
        <FriendProfileModal
          code={viewingFriend.friendCode}
          fallbackDisplayName={viewingFriend.friendDisplayName}
          fallbackBadge={viewingFriend.friendBadge}
          since={viewingFriend.addedAt}
          isSelf={viewingFriend.friendCode === myCode}
          onClose={() => setViewingFriend(null)}
        />
      )}

      {showServerModal && (
        <CreateServerModal
          myCode={myCode}
          myDisplayName={myDisplayName}
          myBadge={myBadge}
          friends={friends}
          onClose={() => setShowServerModal(false)}
        />
      )}
    </div>
  );
}
