"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, Sparkles, Gem, Music2, ShieldAlert, User, Settings } from "lucide-react";
import { CosmeticFrame, CosmeticBadge } from "@/components/CosmeticFrame";
import { formatFriendCode } from "@/lib/friendCode";

const tabs = [
  { href: "/friends/game-hub", label: "Game Hub", icon: LayoutDashboard },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/friends/missions", label: "Missions", icon: Sparkles },
];

const moreLinks = [
  { href: "/store", label: "Store", icon: Gem },
  { href: "/playlist", label: "Playlist", icon: Music2 },
];

export default function FriendsSidebar({
  isAdmin,
  displayName,
  avatarDataUrl,
  friendCode,
  equippedFrame,
  equippedBadge,
  nameEffect,
  nameEffectColor1,
  nameEffectColor2,
}: {
  isAdmin: boolean;
  displayName: string;
  avatarDataUrl: string | null;
  friendCode: string;
  equippedFrame: string | null;
  equippedBadge: string | null;
  nameEffect: string | null;
  nameEffectColor1: string | null;
  nameEffectColor2: string | null;
}) {
  const pathname = usePathname();
  const links = isAdmin ? [...moreLinks, { href: "/moderation", label: "Moderation", icon: ShieldAlert }] : moreLinks;
  const nameIsGradient = nameEffect === "gradient-cycle";
  const nameGradientStyle =
    nameIsGradient && nameEffectColor1 && nameEffectColor2
      ? ({ "--name-color-1": nameEffectColor1, "--name-color-2": nameEffectColor2 } as React.CSSProperties)
      : undefined;

  return (
    <div className="flex shrink-0 flex-col md:w-52">
      <nav className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-52 md:flex-col md:overflow-visible md:pb-0">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "text-accent-bright" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="friends-sidebar-active-pill"
                  className="glow-accent absolute inset-0 rounded-lg bg-accent/10 ring-1 ring-accent/30"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={18} className="relative z-10" />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}

        <div className="mx-3 my-1 hidden border-t border-border/60 md:block" />

        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "text-accent-bright" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="friends-sidebar-active-pill"
                  className="glow-accent absolute inset-0 rounded-lg bg-accent/10 ring-1 ring-accent/30"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <Icon size={18} className="relative z-10" />
              <span className="relative z-10">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto hidden items-center gap-2 rounded-lg border-t border-border/60 bg-surface-2/40 px-2 py-2 md:flex">
        <Link
          href="/profile"
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 transition-colors hover:bg-surface-2/60"
          title="Edit profile"
        >
          <CosmeticFrame frameId={equippedFrame}>
            {avatarDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
              <img
                src={avatarDataUrl}
                alt={displayName}
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="icon-badge h-9 w-9 shrink-0">
                <User size={16} />
              </div>
            )}
          </CosmeticFrame>
          <div className="min-w-0">
            <p
              className={`truncate text-sm font-medium ${nameIsGradient ? "name-gradient-cycle" : "text-foreground"}`}
              style={nameGradientStyle}
            >
              {displayName}
            </p>
            <p className="truncate text-[11px] text-muted">{formatFriendCode(friendCode)}</p>
          </div>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <CosmeticBadge badgeId={equippedBadge} />
          <Link
            href="/profile"
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            title="Profile settings"
          >
            <Settings size={16} />
          </Link>
        </div>
      </div>
    </div>
  );
}
