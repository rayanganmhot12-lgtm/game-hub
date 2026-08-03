"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, Sparkles, Gem, Music2, ShieldAlert } from "lucide-react";
import SidebarProfilePanel from "@/components/SidebarProfilePanel";

const tabs = [
  { href: "/friends/game-hub", label: "Game Hub", icon: LayoutDashboard },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/friends/missions", label: "Missions", icon: Sparkles },
];

const moreLinks = [
  { href: "/store", label: "Store", icon: Gem },
  { href: "/playlist", label: "Playlist", icon: Music2 },
];

// Both groups render identical rows, so they share one component rather than
// two copies of the same markup that could drift apart.
function NavItem({ href, label, icon: Icon, active }: { href: string; label: string; icon: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
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
}

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

  // Exact match, not startsWith: "/friends" is a prefix of every tab here, so
  // a prefix test would light up Friends on the Missions and Game Hub pages
  // too. The second group leaves this column behind entirely, so its rows are
  // only ever active on their own landing page.
  const isActive = (href: string) => pathname === href;

  return (
    <div className="flex shrink-0 flex-col md:w-52">
      <nav className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-52 md:flex-col md:overflow-visible md:pb-0">
        {tabs.map((tab) => (
          <NavItem key={tab.href} {...tab} active={isActive(tab.href)} />
        ))}

        <p className="mt-4 hidden px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/60 md:block">
          More
        </p>

        {links.map((link) => (
          <NavItem key={link.href} {...link} active={isActive(link.href)} />
        ))}
      </nav>

      <SidebarProfilePanel
        displayName={displayName}
        avatarDataUrl={avatarDataUrl}
        friendCode={friendCode}
        equippedFrame={equippedFrame}
        equippedBadge={equippedBadge}
        nameEffect={nameEffect}
        nameEffectColor1={nameEffectColor1}
        nameEffectColor2={nameEffectColor2}
      />
    </div>
  );
}
