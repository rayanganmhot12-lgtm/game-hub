"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Library, Trophy, Plug, Music2, Gem, Palette, Sparkles, Users, ShieldAlert } from "lucide-react";
import UserPanel from "@/components/UserPanel";

const baseLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/library", label: "Library", icon: Library },
  { href: "/achievements", label: "Achievements", icon: Trophy },
  { href: "/friends", label: "Community", icon: Users },
  { href: "/connect", label: "Connections", icon: Plug },
  { href: "/playlist", label: "Playlist", icon: Music2 },
  { href: "/store", label: "Store", icon: Gem },
  { href: "/theme-editor", label: "Theme Editor", icon: Palette },
  { href: "/recap", label: "Recap", icon: Sparkles },
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
  const links = isAdmin
    ? [...baseLinks, { href: "/moderation", label: "Moderation", icon: ShieldAlert }]
    : baseLinks;

  // Inside a server, the server rail + channel sidebar take over as
  // navigation — the main app nav would just be redundant clutter.
  if (pathname.startsWith("/groups/")) return null;

  return (
    <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-72 shrink-0 flex-col border-r border-border/60 bg-surface/40 backdrop-blur-xl md:flex">
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
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
      </nav>
      <div className="mt-6 pb-24">
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
