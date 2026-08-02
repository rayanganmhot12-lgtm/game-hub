"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Frame, Award, Image as ImageIcon } from "lucide-react";
import type { CosmeticItem } from "@/lib/cosmetics";

const tabs = [
  { href: "/store", type: "frame" as const, label: "Avatar Frames", icon: Frame },
  { href: "/store/badges", type: "badge" as const, label: "Badges", icon: Award },
  { href: "/store/banners", type: "banner" as const, label: "Profile Banners", icon: ImageIcon },
];

export default function StoreSidebar({
  catalog,
  unlockedCosmetics,
}: {
  catalog: CosmeticItem[];
  unlockedCosmetics: string[];
}) {
  const pathname = usePathname();

  const countsFor = (type: CosmeticItem["type"]) => {
    const total = catalog.filter((c) => c.type === type).length;
    const owned = catalog.filter((c) => c.type === type && unlockedCosmetics.includes(c.id)).length;
    return `${owned}/${total}`;
  };

  return (
    <nav className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-52 md:flex-col md:overflow-visible md:pb-0">
      {tabs.map(({ href, type, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex shrink-0 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "text-accent-bright" : "text-muted hover:bg-surface-2/60 hover:text-foreground"
            }`}
          >
            {active && (
              <motion.div
                layoutId="store-sidebar-active-pill"
                className="glow-accent absolute inset-0 rounded-lg bg-accent/10 ring-1 ring-accent/30"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-3">
              <Icon size={18} />
              {label}
            </span>
            <span className={`relative z-10 text-xs ${active ? "text-accent-bright/70" : "text-muted/70"}`}>
              {countsFor(type)}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
