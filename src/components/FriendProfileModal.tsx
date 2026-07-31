"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { X, CalendarDays, Pencil, Copy, Check, ChevronRight, Phone, Plus } from "lucide-react";
import { CosmeticFrame, CosmeticBadge, CosmeticBanner, CosmeticPreview } from "@/components/CosmeticFrame";
import { TagChip } from "@/components/ServerChips";
import { RoleChip } from "@/components/ServerModerationTabs";
import SwitchAccountsMenu from "@/components/SwitchAccountsMenu";
import Avatar from "@/components/Avatar";
import { useToast } from "@/context/ToastContext";
import { fetchProfile, type PublicProfile } from "@/lib/profileRealtime";
import {
  listenToPresence,
  setMyStatus,
  presenceDisplay,
  STATUS_META,
  type PresenceState,
  type PresenceStatusValue,
} from "@/lib/presence";
import {
  listenForCallPresence,
  listenForGroupCallParticipants,
  type CallPresence,
  type GroupCallParticipant,
} from "@/lib/groupCallRealtime";
import { getCosmetic, PLUS_ITEM_ID } from "@/lib/cosmetics";
import { type GroupRole } from "@/lib/groupRealtime";
import { formatFriendCode } from "@/lib/friendCode";

export default function FriendProfileModal({
  code,
  fallbackDisplayName,
  fallbackBadge,
  since,
  isSelf,
  serverRole,
  onClose,
}: {
  code: string;
  fallbackDisplayName: string;
  fallbackBadge?: string | null;
  since?: string | Date | null;
  // Whether this is the viewer's own profile — unlocks the Edit Profile
  // link, the status picker, and the "pin a favorite" prompt, matching
  // Discord only showing those on your own profile popup.
  isSelf?: boolean;
  // This member's role in whichever server the profile was opened from —
  // not part of their global profile, so it's passed in by the caller
  // rather than fetched here.
  serverRole?: GroupRole | null;
  onClose: () => void;
}) {
  const { showToast } = useToast();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [presence, setPresence] = useState<PresenceState | null>(null);
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [callPresence, setCallPresence] = useState<CallPresence | null>(null);
  const [callParticipants, setCallParticipants] = useState<Array<GroupCallParticipant & { code: string }>>([]);
  const [copied, setCopied] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [myUnlocked, setMyUnlocked] = useState<string[] | null>(null);
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchProfile(code)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    return listenToPresence(code, setPresence);
  }, [code]);

  useEffect(() => {
    return listenForCallPresence(code, setCallPresence);
  }, [code]);

  useEffect(() => {
    if (!callPresence) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCallParticipants([]);
      return;
    }
    return listenForGroupCallParticipants(callPresence.groupId, setCallParticipants);
  }, [callPresence]);

  const displayName = profile?.displayName ?? fallbackDisplayName;
  const badge = profile?.badge ?? fallbackBadge ?? null;
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const presenceInfo = presenceDisplay(presence, Boolean(isSelf));
  const pinnedItem = profile?.pinnedCosmeticId ? getCosmetic(profile.pinnedCosmeticId) : undefined;

  async function chooseStatus(status: PresenceStatusValue) {
    await setMyStatus(code, status);
    setStatusMenuOpen(false);
  }

  function copyUserId() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function openPicker() {
    setPickerOpen(true);
    if (myUnlocked !== null) return;
    try {
      const res = await fetch("/api/store/my-cosmetics");
      const data = await res.json();
      setMyUnlocked(res.ok ? (data.unlockedCosmetics as string[]) : []);
    } catch {
      setMyUnlocked([]);
    }
  }

  async function pinCosmetic(itemId: string | null) {
    setSavingPin(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedCosmeticId: itemId }),
      });
      if (res.ok) {
        setProfile((prev) => (prev ? { ...prev, pinnedCosmeticId: itemId } : prev));
        setPickerOpen(false);
      } else {
        showToast("Couldn't update your favorite.", "error");
      }
    } finally {
      setSavingPin(false);
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
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="panel relative w-full max-w-xs overflow-hidden !p-0 text-center"
          style={
            profile?.accentColor
              ? { borderColor: profile.accentColor, boxShadow: `0 0 24px -6px ${profile.accentColor}` }
              : undefined
          }
        >
          <button
            onClick={onClose}
            className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white/90 backdrop-blur transition-colors hover:bg-black/60"
          >
            <X size={16} />
          </button>

          <div className="relative h-24 w-full bg-surface-2">
            <CosmeticBanner bannerId={profile?.banner}>
              {profile?.bannerDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                <img src={profile.bannerDataUrl} alt="" className="h-24 w-full object-cover" />
              ) : (
                <div className="h-24 w-full bg-gradient-to-br from-surface-2 to-surface" />
              )}
            </CosmeticBanner>
          </div>

          <div className="flex flex-col items-center px-6 pb-6">
            <div className="relative -mt-10">
              <CosmeticFrame frameId={profile?.frame}>
                {profile?.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
                  <img
                    src={profile.avatarDataUrl}
                    alt={displayName}
                    width={80}
                    height={80}
                    className="h-20 w-20 rounded-full object-cover ring-4 ring-surface"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-2xl font-semibold text-black ring-4 ring-surface">
                    {initial}
                  </span>
                )}
              </CosmeticFrame>
              <span
                className={`absolute bottom-0.5 right-0.5 block h-4 w-4 rounded-full ring-4 ring-surface ${presenceInfo.dotClassName}`}
                title={presenceInfo.label}
              />
            </div>

            <div className="mt-3 flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{displayName}</h2>
              <CosmeticBadge badgeId={badge} />
              {profile?.tag && <TagChip tag={profile.tag} />}
            </div>
            {profile?.pronouns && <p className="text-[11px] text-muted">{profile.pronouns}</p>}
            <p className="mt-1 text-xs text-muted">{formatFriendCode(code)}</p>
            {profile?.profileNote && (
              <p className="mt-1 max-w-[240px] text-center text-xs italic text-foreground/80">{profile.profileNote}</p>
            )}

            {serverRole && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <RoleChip role={serverRole} />
              </div>
            )}

            <div className="mt-2 flex items-center justify-center">
              {pinnedItem ? (
                <button
                  onClick={isSelf ? openPicker : undefined}
                  disabled={!isSelf}
                  title={pinnedItem.name}
                  className={`flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-2 py-1 text-xs text-foreground ${
                    isSelf ? "transition-colors hover:bg-surface-2/60" : ""
                  }`}
                >
                  <CosmeticPreview item={pinnedItem} />
                  <span className="truncate">{pinnedItem.name}</span>
                </button>
              ) : isSelf ? (
                <button
                  onClick={openPicker}
                  className="flex items-center gap-1.5 rounded-full border border-dashed border-border px-2.5 py-1 text-[11px] text-muted transition-colors hover:border-accent-bright hover:text-accent-bright"
                >
                  <Plus size={11} />
                  Favorite collectible?
                </button>
              ) : null}
            </div>

            {pickerOpen && isSelf && (
              <div className="mt-2 w-full rounded-lg border border-border bg-surface-2/40 p-3 text-left">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Pick a Favorite</p>
                  <button onClick={() => setPickerOpen(false)} className="text-muted hover:text-foreground">
                    <X size={13} />
                  </button>
                </div>
                {myUnlocked === null ? (
                  <p className="text-xs text-muted">Loading…</p>
                ) : myUnlocked.filter((id) => id !== PLUS_ITEM_ID).length === 0 ? (
                  <p className="text-xs text-muted">Nothing unlocked yet — check the Store.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {myUnlocked
                      .filter((id) => id !== PLUS_ITEM_ID)
                      .map((id) => {
                        const item = getCosmetic(id);
                        if (!item) return null;
                        return (
                          <button
                            key={id}
                            onClick={() => pinCosmetic(id)}
                            disabled={savingPin}
                            title={item.name}
                            className="flex items-center justify-center rounded-lg border border-border/60 bg-surface-2/30 p-2 transition-colors hover:border-accent-bright"
                          >
                            <CosmeticPreview item={item} />
                          </button>
                        );
                      })}
                  </div>
                )}
                {profile?.pinnedCosmeticId && (
                  <button
                    onClick={() => pinCosmetic(null)}
                    disabled={savingPin}
                    className="mt-2 text-[11px] text-muted transition-colors hover:text-foreground"
                  >
                    Clear favorite
                  </button>
                )}
              </div>
            )}

            {callPresence && (
              <div className="mt-4 w-full rounded-lg border border-border/60 bg-surface-2/30 p-3 text-left">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted">
                  <Phone size={11} />
                  In a call
                </p>
                <div className="mb-3 flex -space-x-2">
                  {callParticipants.slice(0, 6).map((p) => (
                    <div key={p.code} className="ring-2 ring-surface rounded-full" title={p.displayName}>
                      <Avatar name={p.displayName} size={28} />
                    </div>
                  ))}
                </div>
                <Link href={`/groups/${callPresence.groupId}`} onClick={onClose} className="btn-primary block w-full !py-2 !text-xs">
                  Open Call
                </Link>
              </div>
            )}

            {(profile?.bio || since) && (
              <div className="mt-4 w-full space-y-3 rounded-lg border border-border/60 bg-surface-2/30 p-3 text-left">
                {profile?.bio && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">About Me</p>
                    <p className="mt-1 text-sm text-foreground">{profile.bio}</p>
                  </div>
                )}
                {since && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted">Member Since</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground">
                      <CalendarDays size={12} className="text-muted" />
                      {new Date(since).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                )}
              </div>
            )}
            {loading && <p className="mt-3 text-xs text-muted">Loading latest profile…</p>}
            {!loading && !profile && (
              <p className="mt-3 text-xs text-muted">{`${fallbackDisplayName} hasn't opened Game Hub with the profile feature yet.`}</p>
            )}

            <div className="mt-4 flex w-full flex-col gap-1 text-left">
              {isSelf && (
                <Link
                  href="/profile"
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface-2/60"
                >
                  <Pencil size={13} />
                  Edit Profile
                </Link>
              )}
              {isSelf && (
                <div className="rounded-lg border border-border/60 bg-surface-2/30 text-xs text-foreground">
                  <button
                    onClick={() => setStatusMenuOpen((v) => !v)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-surface-2/60"
                  >
                    <span className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${presenceInfo.dotClassName}`} />
                      {presenceInfo.label}
                    </span>
                    <ChevronRight size={13} className={`transition-transform ${statusMenuOpen ? "rotate-90" : ""}`} />
                  </button>
                  {statusMenuOpen && (
                    <div className="border-t border-border/60 py-1">
                      {(Object.keys(STATUS_META) as PresenceStatusValue[]).map((key) => (
                        <button
                          key={key}
                          onClick={() => chooseStatus(key)}
                          className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-surface-2/60"
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_META[key].dotClassName}`} />
                          {STATUS_META[key].label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {isSelf && <SwitchAccountsMenu />}
              <button
                onClick={copyUserId}
                className="flex w-full items-center gap-2 rounded-lg border border-border/60 bg-surface-2/30 px-3 py-2 text-xs text-foreground transition-colors hover:bg-surface-2/60"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                {copied ? "Copied!" : "Copy User ID"}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
