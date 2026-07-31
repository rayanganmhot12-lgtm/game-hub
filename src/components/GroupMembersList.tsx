"use client";

import { useEffect, useRef, useState } from "react";
import { Crown } from "lucide-react";
import { listenToPresence } from "@/lib/presence";
import { isFirebaseConfigured } from "@/lib/firebase";
import { CosmeticBadge, CosmeticFrame } from "@/components/CosmeticFrame";
import Avatar from "@/components/Avatar";
import FriendProfileModal from "@/components/FriendProfileModal";
import { fetchProfile, type PublicProfile } from "@/lib/profileRealtime";
import { TagChip, NicknameModal, tagColorClassName, type GroupMemberEntry } from "@/components/ServerChips";
import MemberContextMenu, { type MemberContextMenuTarget } from "@/components/MemberContextMenu";
import type { GroupTag, GroupRole } from "@/lib/groupRealtime";

export type { GroupMemberEntry };

export default function GroupMembersList({
  groupId,
  myCode,
  creatorCode,
  members,
  tag,
  roles,
  onMention,
}: {
  groupId: string;
  myCode: string;
  creatorCode: string | null;
  members: GroupMemberEntry[];
  tag: GroupTag | null;
  roles: Array<GroupRole & { id: string }>;
  onMention: (member: GroupMemberEntry) => void;
}) {
  const [onlineMap, setOnlineMap] = useState<Record<string, boolean>>({});
  const [profiles, setProfiles] = useState<Record<string, PublicProfile>>({});
  const [viewing, setViewing] = useState<GroupMemberEntry | null>(null);
  const [menuTarget, setMenuTarget] = useState<MemberContextMenuTarget | null>(null);
  const [editingNickname, setEditingNickname] = useState<GroupMemberEntry | null>(null);
  const fetchedProfileCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    const unsubs = members.map((m) =>
      listenToPresence(m.code, (state) => setOnlineMap((prev) => ({ ...prev, [m.code]: Boolean(state?.online) })))
    );
    return () => unsubs.forEach((u) => u());
  }, [members]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    // Each member's photo/frame lives in their own installation's published
    // profile, not this local Group mirror — fetch it once per member seen,
    // same one-shot lookup FriendProfileModal already uses.
    for (const m of members) {
      if (fetchedProfileCodesRef.current.has(m.code)) continue;
      fetchedProfileCodesRef.current.add(m.code);
      fetchProfile(m.code).then((profile) => {
        if (profile) setProfiles((prev) => ({ ...prev, [m.code]: profile }));
      });
    }
  }, [members]);

  const online = members.filter((m) => onlineMap[m.code]);
  const offline = members.filter((m) => !onlineMap[m.code]);

  // Online members with a role get their own section headed by the role's
  // name (colored to match), same as Discord's hoisted-role grouping —
  // everyone else just falls under "Online". Offline members always stay
  // in one bucket regardless of role.
  const roleGroups = roles
    .map((role) => ({ role, members: online.filter((m) => m.roleId === role.id) }))
    .filter((g) => g.members.length > 0);
  const roleIdsWithSection = new Set(roleGroups.map((g) => g.role.id));
  const onlineNoRole = online.filter((m) => !m.roleId || !roleIdsWithSection.has(m.roleId));

  function Row({ member, dimmed }: { member: GroupMemberEntry; dimmed?: boolean }) {
    const role = member.roleId ? roles.find((r) => r.id === member.roleId) : undefined;
    const profile = profiles[member.code];
    return (
      <button
        onClick={() => setViewing(member)}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuTarget({ member, x: e.clientX, y: e.clientY });
        }}
        className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2/60 ${dimmed ? "opacity-50 hover:opacity-100" : ""}`}
      >
        <div className="relative shrink-0">
          <CosmeticFrame frameId={profile?.frame}>
            {profile?.avatarDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
              <img
                src={profile.avatarDataUrl}
                alt={member.displayName}
                width={28}
                height={28}
                className="h-7 w-7 rounded-full object-cover"
              />
            ) : (
              <Avatar name={member.displayName} size={28} />
            )}
          </CosmeticFrame>
          {role && (
            <span
              title={role.name}
              className={`absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface ring-2 ring-surface ${tagColorClassName(role.color)}`}
            >
              <Crown size={9} fill="currentColor" />
            </span>
          )}
          {!dimmed && (
            <span className="absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-surface" />
          )}
        </div>
        <span className="truncate text-sm text-foreground">{member.displayName}</span>
        <CosmeticBadge badgeId={profile?.badge ?? member.badge} />
        {tag && member.tagEquipped && <TagChip tag={tag} />}
      </button>
    );
  }

  return (
    <>
      <div className="hidden w-60 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border/60 bg-surface/40 p-3 lg:flex">
        {roleGroups.map(({ role, members: roleMembers }) => (
          <div key={role.id}>
            <p className={`mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide ${tagColorClassName(role.color)}`}>
              {role.name} — {roleMembers.length}
            </p>
            <div className="flex flex-col gap-0.5">
              {roleMembers.map((m) => (
                <Row key={m.code} member={m} />
              ))}
            </div>
          </div>
        ))}
        {onlineNoRole.length > 0 && (
          <div>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Online — {onlineNoRole.length}
            </p>
            <div className="flex flex-col gap-0.5">
              {onlineNoRole.map((m) => (
                <Row key={m.code} member={m} />
              ))}
            </div>
          </div>
        )}
        {offline.length > 0 && (
          <div>
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              Offline — {offline.length}
            </p>
            <div className="flex flex-col gap-0.5">
              {offline.map((m) => (
                <Row key={m.code} member={m} dimmed />
              ))}
            </div>
          </div>
        )}
      </div>

      {viewing && (
        <FriendProfileModal
          code={viewing.code}
          fallbackDisplayName={viewing.displayName}
          fallbackBadge={viewing.badge}
          isSelf={viewing.code === myCode}
          serverRole={viewing.roleId ? roles.find((r) => r.id === viewing.roleId) : null}
          onClose={() => setViewing(null)}
        />
      )}

      {menuTarget && (
        <MemberContextMenu
          target={menuTarget}
          groupId={groupId}
          myCode={myCode}
          creatorCode={creatorCode}
          roles={roles}
          onClose={() => setMenuTarget(null)}
          onViewProfile={setViewing}
          onMention={onMention}
          onEditNickname={setEditingNickname}
        />
      )}

      {editingNickname && (
        <NicknameModal
          groupId={groupId}
          myCode={myCode}
          targetCode={editingNickname.code}
          targetDisplayName={editingNickname.displayName}
          tag={tag}
          onClose={() => setEditingNickname(null)}
        />
      )}
    </>
  );
}
