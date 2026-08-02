"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Users, Trophy } from "lucide-react";

const tabs = [
  { href: "/friends/game-hub", label: "Game Hub", icon: LayoutDashboard },
  { href: "/friends", label: "Friends", icon: Users },
  { href: "/friends/missions", label: "Missions", icon: Trophy },
];

export default function FriendsSidebar() {
  const pathname = usePathname();

  return (
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
  );
}
