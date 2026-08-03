"use client";

import { useEffect, useRef, useState } from "react";
import { Trash2, Plus, UserX, Ban as BanIcon, Camera } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import ProfileAvatar from "@/components/ProfileAvatar";
import { TAG_COLORS } from "@/components/GroupChannelsSidebar";
import type { GroupMemberEntry } from "@/components/GroupChannelsSidebar";
import {
  leaveGroupRoster,
  banFromGroup,
  unbanFromGroup,
  listenForGroupBans,
  setMemberRole,
  createGroupRole,
  deleteGroupRole,
  setGroupBannedWords,
  listenForGroupBannedWords,
  createGroupEmoji,
  deleteGroupEmoji,
  listenForGroupEmoji,
  type GroupRole,
  type GroupBanEntry,
  type GroupEmoji,
} from "@/lib/groupRealtime";

export function RoleChip({ role }: { role: GroupRole }) {
  const cls = TAG_COLORS.find((c) => c.id === role.color)?.className ?? TAG_COLORS[0].className;
  return <span className={`rounded px-1 py-0 text-[9px] font-bold leading-4 ${cls}`}>{role.name}</span>;
}

export function MembersTab({
  groupId,
  members,
  roles,
  myCode,
}: {
  groupId: string;
  members: GroupMemberEntry[];
  roles: Array<GroupRole & { id: string }>;
  myCode: string;
}) {
  const { showToast } = useToast();
  const [busyCode, setBusyCode] = useState<string | null>(null);

  async function kick(code: string) {
    setBusyCode(code);
    try {
      await leaveGroupRoster(groupId, code);
      await fetch(`/api/groups/${groupId}/members?memberCode=${code}`, { method: "DELETE" });
      showToast("Member removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't remove member.", "error");
    } finally {
      setBusyCode(null);
    }
  }

  async function ban(code: string, displayName: string) {
    setBusyCode(code);
    try {
      await banFromGroup(groupId, code, displayName);
      await leaveGroupRoster(groupId, code);
      await fetch(`/api/groups/${groupId}/members?memberCode=${code}`, { method: "DELETE" });
      showToast("Member banned.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't ban member.", "error");
    } finally {
      setBusyCode(null);
    }
  }

  async function assignRole(code: string, roleId: string) {
    try {
      await setMemberRole(groupId, code, roleId || null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't assign role.", "error");
    }
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <h2 className="section-title mb-4">Members</h2>
      <div className="flex flex-col gap-1">
        {members.map((m) => (
          <div key={m.code} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2/40">
            <ProfileAvatar code={m.code} displayName={m.displayName} size={28} />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">{m.displayName}</span>
            {roles.length > 0 && (
              <select
                value={m.roleId ?? ""}
                onChange={(e) => assignRole(m.code, e.target.value)}
                className="input-field !w-28 !py-1 !text-xs"
              >
                <option value="">No role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            )}
            {m.code !== myCode && (
              <>
                <button
                  onClick={() => kick(m.code)}
                  disabled={busyCode === m.code}
                  title="Kick"
                  className="text-muted hover:text-amber-400"
                >
                  <UserX size={15} />
                </button>
                <button
                  onClick={() => ban(m.code, m.displayName)}
                  disabled={busyCode === m.code}
                  title="Ban"
                  className="text-muted hover:text-red-400"
                >
                  <BanIcon size={15} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function RolesTab({ groupId, roles }: { groupId: string; roles: Array<GroupRole & { id: string }> }) {
  const { showToast } = useToast();
  const [name, setName] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0].id);
  const [busy, setBusy] = useState(false);

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await createGroupRole(groupId, trimmed, color);
      setName("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't create role.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function remove(roleId: string) {
    try {
      await deleteGroupRole(groupId, roleId);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete role.", "error");
    }
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <h2 className="section-title mb-1">Roles</h2>
      <p className="mb-4 text-xs text-muted">Simple name tags — no permissions or channel access attached.</p>

      <div className="mb-4 flex flex-col gap-1">
        {roles.map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-2/40">
            <RoleChip role={r} />
            <button onClick={() => remove(r.id)} className="text-muted hover:text-red-400">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">New Role Name</label>
      <input value={name} onChange={(e) => setName(e.target.value.slice(0, 30))} className="input-field mb-3 w-full" placeholder="e.g. Moderator" />

      <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Color</label>
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

      <button onClick={add} disabled={busy} className="btn-primary w-full">
        <Plus size={14} />
        Add Role
      </button>
    </div>
  );
}

export function BansTab({ groupId }: { groupId: string }) {
  const { showToast } = useToast();
  const [bans, setBans] = useState<Array<GroupBanEntry & { code: string }>>([]);

  useEffect(() => {
    return listenForGroupBans(groupId, setBans);
  }, [groupId]);

  async function unban(code: string) {
    try {
      await unbanFromGroup(groupId, code);
      showToast("Unbanned.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't unban.", "error");
    }
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <h2 className="section-title mb-4">Banned Users</h2>
      {bans.length === 0 ? (
        <p className="text-xs text-muted">No one&apos;s banned from this server.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {bans.map((b) => (
            <div key={b.code} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface-2/40">
              <span className="text-sm text-foreground">{b.displayName}</span>
              <button onClick={() => unban(b.code)} className="btn-ghost !px-2.5 !py-1 !text-xs">
                Unban
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AutoModTab({ groupId }: { groupId: string }) {
  const { showToast } = useToast();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    return listenForGroupBannedWords(groupId, (words) => setText(words.join("\n")));
  }, [groupId]);

  async function save() {
    setSaving(true);
    try {
      const words = text
        .split("\n")
        .map((w) => w.trim().toLowerCase())
        .filter(Boolean);
      await setGroupBannedWords(groupId, words);
      showToast("AutoMod list saved.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save list.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <h2 className="section-title mb-1">AutoMod</h2>
      <p className="mb-4 text-xs text-muted">
        Messages containing any of these words or phrases are blocked before sending. One per line.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        placeholder={"badword\nanother phrase"}
        className="input-field mb-4 w-full resize-none font-mono text-xs"
      />
      <button onClick={save} disabled={saving} className="btn-primary w-full">
        Save
      </button>
    </div>
  );
}

const EMOJI_SIZE = 64;

function resizeEmoji(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = EMOJI_SIZE;
      canvas.height = EMOJI_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas isn't supported in this browser."));
        return;
      }
      const scale = Math.max(EMOJI_SIZE / img.width, EMOJI_SIZE / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (EMOJI_SIZE - w) / 2, (EMOJI_SIZE - h) / 2, w, h);
      resolve(canvas.toDataURL("image/png"));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = URL.createObjectURL(file);
  });
}

export function EmojiTab({ groupId }: { groupId: string }) {
  const { showToast } = useToast();
  const [emoji, setEmoji] = useState<Array<GroupEmoji & { id: string }>>([]);
  const [name, setName] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return listenForGroupEmoji(groupId, setEmoji);
  }, [groupId]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Pick an image file.", "error");
      return;
    }
    try {
      setPending(await resizeEmoji(file));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't read that image.", "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function add() {
    const trimmed = name.trim().replace(/[^a-zA-Z0-9_]/g, "").slice(0, 20);
    if (!trimmed || !pending) {
      showToast("Pick an image and enter a name.", "error");
      return;
    }
    try {
      await createGroupEmoji(groupId, trimmed, pending);
      setName("");
      setPending(null);
      showToast("Emoji added.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't add emoji.", "error");
    }
  }

  async function remove(id: string) {
    try {
      await deleteGroupEmoji(groupId, id);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't delete emoji.", "error");
    }
  }

  return (
    <div className="max-h-[70vh] overflow-y-auto pr-1">
      <h2 className="section-title mb-1">Emoji</h2>
      <p className="mb-4 text-xs text-muted">
        Type <code className="text-accent-bright">:name:</code> in a message to use one of these here.
      </p>

      {emoji.length > 0 && (
        <div className="mb-4 grid grid-cols-4 gap-2">
          {emoji.map((e) => (
            <div key={e.id} className="relative flex flex-col items-center gap-1 rounded-lg border border-border bg-surface-2/30 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset */}
              <img src={e.dataUrl} alt={e.name} className="h-8 w-8 object-contain" />
              <span className="truncate text-[10px] text-muted">:{e.name}:</span>
              <button onClick={() => remove(e.id)} className="absolute right-1 top-1 text-muted hover:text-red-400">
                <Trash2 size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2/40"
        >
          {pending ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
            <img src={pending} alt="" className="h-8 w-8 object-contain" />
          ) : (
            <Camera size={16} className="text-muted" />
          )}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="name" className="input-field flex-1 !text-xs" />
        <button onClick={add} className="btn-primary !px-3 !py-2 !text-xs">
          Add
        </button>
      </div>
    </div>
  );
}
