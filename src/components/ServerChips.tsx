// Small shared display bits for the "servers" feature — split out from
// GroupChannelsSidebar so that sibling components (ServerModerationTabs,
// GroupMembersList, GroupChatWindow, FriendProfileModal) can use them
// without creating an import cycle back through GroupChannelsSidebar.
"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { ref, get } from "firebase/database";
import { getFirebaseDb } from "@/lib/firebase";
import { setGroupNickname, setTagEquipped, type GroupTag } from "@/lib/groupRealtime";
import { publishActiveTag } from "@/lib/profileRealtime";
import { useToast } from "@/context/ToastContext";

export interface GroupMemberEntry {
  code: string;
  displayName: string;
  badge?: string | null;
  tagEquipped?: boolean;
  roleId?: string | null;
}

export const BANNER_SWATCHES: { id: string; className: string }[] = [
  { id: "none", className: "bg-surface-2" },
  { id: "pink", className: "bg-gradient-to-br from-pink-500 to-fuchsia-600" },
  { id: "red", className: "bg-gradient-to-br from-red-500 to-rose-600" },
  { id: "orange", className: "bg-gradient-to-br from-orange-400 to-amber-500" },
  { id: "yellow", className: "bg-gradient-to-br from-yellow-300 to-amber-400" },
  { id: "purple", className: "bg-gradient-to-br from-purple-500 to-violet-600" },
  { id: "blue", className: "bg-gradient-to-br from-sky-400 to-blue-600" },
  { id: "teal", className: "bg-gradient-to-br from-teal-300 to-emerald-400" },
  { id: "green", className: "bg-gradient-to-br from-lime-400 to-green-600" },
  { id: "gray", className: "bg-gradient-to-br from-neutral-500 to-neutral-700" },
];

export function bannerClassName(id?: string | null) {
  return BANNER_SWATCHES.find((b) => b.id === id)?.className ?? "bg-surface-2";
}

export const TAG_BADGES = ["🍃", "⚔️", "💗", "🔥", "💧", "💀", "🌙", "⚡", "✨", "🍄"];

export const TAG_COLORS: { id: string; className: string }[] = [
  { id: "gray", className: "border-neutral-400 text-neutral-300" },
  { id: "green", className: "border-emerald-400 text-emerald-300" },
  { id: "blue", className: "border-sky-400 text-sky-300" },
  { id: "purple", className: "border-purple-400 text-purple-300" },
  { id: "red", className: "border-rose-400 text-rose-300" },
];

export function tagColorClassName(id?: string | null) {
  return TAG_COLORS.find((c) => c.id === id)?.className ?? TAG_COLORS[0].className;
}

export function TagChip({ tag }: { tag: GroupTag }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded border px-1 py-0 text-[9px] font-bold uppercase leading-4 ${tagColorClassName(tag.color)}`}
    >
      {tag.badge} {tag.name}
    </span>
  );
}

// Edits a per-server nickname — normally your own, but the server creator can
// also open this targeting another member (from their right-click context menu).
// The tag-equip choice is always personal, so it's only offered when editing yourself.
export function NicknameModal({
  groupId,
  myCode,
  targetCode,
  targetDisplayName,
  tag,
  onClose,
}: {
  groupId: string;
  myCode: string;
  targetCode?: string;
  targetDisplayName?: string;
  tag: GroupTag | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const editingCode = targetCode ?? myCode;
  const isSelf = editingCode === myCode;
  const [nickname, setNickname] = useState("");
  const [tagEquipped, setLocalTagEquipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const db = getFirebaseDb();
    if (!db) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    get(ref(db, `groupChats/${groupId}/roster/${editingCode}`))
      .then((snap) => {
        const val = snap.val() as { nickname?: string; tagEquipped?: boolean } | null;
        setNickname(val?.nickname ?? "");
        setLocalTagEquipped(Boolean(val?.tagEquipped));
      })
      .finally(() => setLoading(false));
  }, [groupId, editingCode]);

  async function save() {
    setSaving(true);
    try {
      await setGroupNickname(groupId, editingCode, nickname.trim() || null);
      if (isSelf && tag) {
        await setTagEquipped(groupId, myCode, tagEquipped);
        await publishActiveTag(myCode, tagEquipped ? tag : null);
      }
      showToast("Profile updated.", "success");
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
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            {isSelf ? "Nickname in this Server" : `Nickname for ${targetDisplayName ?? "this member"}`}
          </h2>
          <p className="mb-3 text-xs text-muted">
            {isSelf
              ? "Shows instead of your name, only here. Leave empty to reset."
              : "Shows instead of their name, only here. Leave empty to reset."}
          </p>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value.slice(0, 32))}
            disabled={loading}
            placeholder="Nickname"
            className="input-field mb-4 w-full"
          />
          {isSelf && tag && (
            <label className="mb-4 flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={tagEquipped}
                onChange={(e) => setLocalTagEquipped(e.target.checked)}
                disabled={loading}
              />
              Show
              <TagChip tag={tag} />
              next to my name here
            </label>
          )}
          <button onClick={save} disabled={saving || loading} className="btn-primary w-full">
            Save
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
