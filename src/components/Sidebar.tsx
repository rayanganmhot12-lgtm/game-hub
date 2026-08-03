"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Library,
  Trophy,
  Plug,
  Sparkles,
  Users,
  Gem,
  Music2,
  Clapperboard,
  ShieldAlert,
} from "lucide-react";
import UserPanel from "@/components/UserPanel";

// One list for the whole app. There used to be a second column, FriendsSidebar,
// that replaced this one on Friends, Store, Playlist and Moderation — so six
// destinations disappeared the moment you opened Friends, and a page existed
// (/friends/game-hub) whose only content was cards linking back to four of them.
//
// The first group carries no heading: it is what the app is, and a label over it
// would be naming the obvious. Theme Editor is deliberately absent — it is
// already a button in the navbar, and listing it twice makes it look like two
// different places.
interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label?: string;
  adminOnly?: boolean;
  links: NavLink[];
}

const navGroups: NavGroup[] = [
  {
    links: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/library", label: "Library", icon: Library },
      { href: "/achievements", label: "Achievements", icon: Trophy },
      { href: "/connect", label: "Connections", icon: Plug },
    ],
  },
  {
    label: "Social",
    links: [
      { href: "/friends", label: "Friends", icon: Users },
      { href: "/friends/missions", label: "Missions", icon: Sparkles },
    ],
  },
  {
    label: "More",
    links: [
      { href: "/store", label: "Store", icon: Gem },
      { href: "/playlist", label: "Playlist", icon: Music2 },
      { href: "/recap", label: "Recap", icon: Clapperboard },
    ],
  },
  {
    label: "Admin",
    adminOnly: true,
    links: [{ href: "/moderation", label: "Moderation", icon: ShieldAlert }],
  },
];

export default function Sidebar({
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

  // A server is the one place that still replaces this column: it brings its own
  // channel list, and the server rail is how you leave again. Everywhere else
  // now keeps the app's navigation, including the sections that have their own
  // sub-navigation — those navigate a different axis and sit beside this one.
  if (pathname.startsWith("/groups/")) return null;

  // Exact match for anything whose path is a prefix of a sibling: "/friends" is
  // a prefix of "/friends/missions", so a startsWith test would light both.
  const isActive = (href: string) =>
    href === "/dashboard" || href === "/friends" ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-border/60 bg-surface/40 backdrop-blur-xl md:flex">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4 pt-4">
        {navGroups
          .filter((group) => !group.adminOnly || isAdmin)
          .map((group) => (
            <div key={group.label ?? "main"} className={group.label ? "mt-4" : ""}>
              {group.label && (
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted/60">
                  {group.label}
                </p>
              )}
              <div className="flex flex-col gap-1">
                {group.links.map(({ href, label, icon: Icon }) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active ? "text-accent-bright" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="sidebar-active-pill"
                          className="glow-accent absolute inset-0 rounded-lg bg-accent/10 ring-1 ring-accent/30"
                          transition={{ type: "spring", stiffness: 380, damping: 32 }}
                        />
                      )}
                      <Icon size={18} className="relative z-10" />
                      <span className="relative z-10">{label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
      </nav>
      {/* The music dock is fixed across the full width, so this column's last
          element is the one it would cover. See MusicPlayerBar. */}
      <div className="mt-6 pb-[calc(1rem+var(--music-bar-height,0px))]">
        <UserPanel
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
    </aside>
  );
}
