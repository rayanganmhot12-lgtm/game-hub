"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Camera, Users, Search, Loader2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import ProfileAvatar from "@/components/ProfileAvatar";
import {
  sendGroupInvite,
  joinGroupRoster,
  setGroupName,
  setGroupIcon,
  setGroupCreatedAt,
  setGroupCreator,
  isBannedFromGroup,
  fetchGroupPreview,
  type GroupPreview,
} from "@/lib/groupRealtime";
import { formatFriendCode, normalizeFriendCode } from "@/lib/friendCode";

const SERVER_ICON_SIZE = 128;

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

type Tab = "create" | "join";

export default function CreateServerModal({
  myCode,
  myDisplayName,
  myBadge,
  friends,
  onClose,
}: {
  myCode: string;
  myDisplayName: string;
  myBadge?: string | null;
  friends: Friend[];
  onClose: () => void;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("create");

  const [name, setName] = useState("");
  const [iconPreview, setIconPreview] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const iconInputRef = useRef<HTMLInputElement>(null);

  const [codeInput, setCodeInput] = useState("");
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [previewCode, setPreviewCode] = useState("");
  const [searching, setSearching] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  function toggleFriend(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  async function handleIconPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Pick an image file.", "error");
      return;
    }
    try {
      setIconPreview(await resizeToDataUrl(file, SERVER_ICON_SIZE));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't read that image.", "error");
    }
  }

  async function createServer() {
    const trimmed = name.trim();
    if (!trimmed) {
      showToast("Enter a server name.", "error");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Couldn't create server.");
      const { group } = await res.json();

      await joinGroupRoster(group.groupId, myCode, myDisplayName, myBadge);
      await setGroupName(group.groupId, trimmed);
      await setGroupCreatedAt(group.groupId, Date.now());
      await setGroupCreator(group.groupId, myCode);
      if (iconPreview) await setGroupIcon(group.groupId, iconPreview);

      for (const code of selectedCodes) {
        const friend = friends.find((f) => f.friendCode === code);
        if (!friend) continue;
        await joinGroupRoster(group.groupId, friend.friendCode, friend.friendDisplayName, friend.friendBadge);
        await sendGroupInvite(code, group.groupId, trimmed, myCode, myDisplayName);
        await fetch(`/api/groups/${group.groupId}/members`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            memberCode: friend.friendCode,
            memberDisplayName: friend.friendDisplayName,
            memberBadge: friend.friendBadge,
          }),
        });
      }

      showToast(`"${trimmed}" is ready — share its invite code from the server page.`, "success");
      router.push(`/groups/${group.groupId}`);
      router.refresh();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create server.", "error");
    } finally {
      setCreating(false);
    }
  }

  async function findServer() {
    const code = normalizeFriendCode(codeInput);
    if (code.length < 6) {
      showToast("Enter a valid invite code.", "error");
      return;
    }
    setSearching(true);
    setJoinError("");
    setPreview(null);
    try {
      const found = await fetchGroupPreview(code);
      if (!found) {
        setJoinError("No server found with that code.");
      } else {
        setPreview(found);
        setPreviewCode(code);
      }
    } finally {
      setSearching(false);
    }
  }

  async function joinServer() {
    if (!preview) return;
    setJoining(true);
    try {
      if (await isBannedFromGroup(previewCode, myCode)) {
        showToast("You've been banned from this server.", "error");
        return;
      }
      const res = await fetch("/api/groups/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: previewCode, name: preview.name }),
      });
      if (!res.ok) throw new Error("Couldn't join server.");
      await joinGroupRoster(previewCode, myCode, myDisplayName, myBadge);
      showToast(`Joined ${preview.name}.`, "success");
      router.push(`/groups/${previewCode}`);
      router.refresh();
      onClose();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't join server.", "error");
    } finally {
      setJoining(false);
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
          className="panel relative w-full max-w-sm !p-0 overflow-hidden"
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={16} />
          </button>

          <div className="flex gap-1 border-b border-border p-4 pb-0">
            {(
              [
                ["create", "Create a Server"],
                ["join", "Join a Server"],
              ] as [Tab, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`rounded-t-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  tab === value ? "border-b-2 border-accent-bright text-accent-bright" : "text-muted hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "create" ? (
            <div className="p-5">
              <div className="mb-4 flex items-center gap-3">
                <button
                  onClick={() => iconInputRef.current?.click()}
                  className="group relative shrink-0"
                  title="Server icon"
                >
                  {iconPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                    <img src={iconPreview} alt="" className="h-14 w-14 rounded-full object-cover" />
                  ) : (
                    <span className="icon-badge h-14 w-14">
                      <Users size={20} />
                    </span>
                  )}
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                    <Camera size={15} className="text-white" />
                  </span>
                </button>
                <input ref={iconInputRef} type="file" accept="image/*" onChange={handleIconPick} className="hidden" />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Server name"
                  className="input-field flex-1"
                />
              </div>

              {friends.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                    Invite friends (optional)
                  </p>
                  <div className="mb-4 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                    {friends.map((f) => {
                      const selected = selectedCodes.has(f.friendCode);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleFriend(f.friendCode)}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-150 active:scale-95 ${
                            selected
                              ? "border-accent/60 bg-accent/15 text-accent-bright"
                              : "border-border bg-surface-2/30 text-muted hover:border-accent/30 hover:text-foreground"
                          }`}
                        >
                          {selected ? <Check size={12} /> : <ProfileAvatar code={f.friendCode} displayName={f.friendDisplayName} size={16} />}
                          {f.friendDisplayName}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              <button onClick={createServer} disabled={creating} className="btn-primary w-full">
                {creating && <Loader2 size={14} className="animate-spin" />}
                Create Server
              </button>
            </div>
          ) : (
            <div className="p-5">
              <p className="mb-3 text-xs text-muted">Enter an invite code someone shared with you.</p>
              <div className="flex gap-2">
                <input
                  value={codeInput}
                  onChange={(e) => {
                    setCodeInput(e.target.value);
                    setPreview(null);
                    setJoinError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && findServer()}
                  placeholder="XXXX-XXXX"
                  className="input-field flex-1"
                />
                <button onClick={findServer} disabled={searching} className="btn-ghost !px-3">
                  {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                </button>
              </div>

              {joinError && <p className="mt-3 text-xs text-red-400">{joinError}</p>}

              {preview && (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-surface-2/30 p-3">
                  {preview.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                    <img src={preview.icon} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span className="icon-badge h-11 w-11 shrink-0">
                      <Users size={16} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{preview.name}</p>
                    <p className="text-xs text-muted">
                      {preview.memberCount} member{preview.memberCount === 1 ? "" : "s"} · {formatFriendCode(previewCode)}
                    </p>
                  </div>
                  <button onClick={joinServer} disabled={joining} className="btn-primary !px-3 !py-1.5 !text-xs shrink-0">
                    {joining && <Loader2 size={13} className="animate-spin" />}
                    Join
                  </button>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
