"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, Sparkles } from "lucide-react";
import UserPanel from "@/components/UserPanel";

const tabs = [
  { href: "/friends/game-hub", label: "Game Hub", icon: LayoutDashboard },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/friends/missions", label: "Missions", icon: Sparkles },
];

export default function FriendsSidebar({
  displayName,
  avatarDataUrl,
  friendCode,
  equippedFrame,
  equippedBadge,
  nameEffect,
  nameEffectColor1,
  nameEffectColor2,
}: {
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
      </nav>
      <div className="hidden md:block">
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
    </div>
  );
}
