"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Star, Check, Bookmark } from "lucide-react";
import PlatformBadge from "@/components/PlatformBadge";
import { PlayIconOverlay } from "@/components/PlayButton";
import { formatPlaytime } from "@/lib/format";

export interface GameCardData {
  id: string;
  title: string;
  platform: string;
  platformGameId?: string;
  coverImageUrl?: string | null;
  playtimeMinutes: number;
  installed: boolean;
  rating?: number | null;
  backlog?: boolean;
  unlockedAchievementsCount?: number | null;
  totalAchievements?: number | null;
}

const MotionLink = motion.create(Link);

export default function GameCard({
  game,
  selectable,
  selected,
  onToggleSelect,
}: {
  game: GameCardData;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}) {
  const inner = (
    <>
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-2">
        {game.coverImageUrl ? (
          <Image
            src={game.coverImageUrl}
            alt={game.title}
            fill
            unoptimized
            sizes="(max-width: 768px) 45vw, 200px"
            className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted">
            No cover
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute left-2 top-2">
          {selectable ? (
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                selected ? "border-accent bg-accent text-black" : "border-white/70 bg-black/40"
              }`}
            >
              {selected && <Check size={12} strokeWidth={3} />}
            </span>
          ) : (
            <PlatformBadge platform={game.platform} />
          )}
        </div>
        <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
          {!selectable && game.installed && (
            <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-accent-bright to-accent px-2 py-0.5 text-[10px] font-semibold text-black shadow-[0_0_10px_rgba(var(--accent-rgb),0.6)]">
              <span className="h-1.5 w-1.5 rounded-full bg-black/60" />
              Installed
            </div>
          )}
          {!selectable && game.backlog && (
            <div className="flex items-center gap-1 rounded-full bg-black/60 px-1.5 py-0.5 text-accent-bright backdrop-blur-sm" title="In your backlog">
              <Bookmark size={11} fill="currentColor" />
            </div>
          )}
        </div>
        {!selectable && game.platformGameId && (
          <PlayIconOverlay platform={game.platform} platformGameId={game.platformGameId} />
        )}
        {!!game.totalAchievements && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-black/40"
            title={`${game.unlockedAchievementsCount ?? 0} / ${game.totalAchievements} achievements`}
          >
            <div
              className="h-full bg-gradient-to-r from-accent-bright to-accent"
              style={{
                width: `${Math.min(100, ((game.unlockedAchievementsCount ?? 0) / game.totalAchievements) * 100)}%`,
              }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-foreground transition-colors group-hover:text-accent-bright">
          {game.title}
        </h3>
        <div className="mt-auto flex items-center justify-between">
          <p className="text-xs text-muted">{formatPlaytime(game.playtimeMinutes)} played</p>
          {!!game.rating && (
            <span className="flex items-center gap-0.5 rounded-full bg-accent/10 px-1.5 py-0.5 text-accent-bright">
              <Star size={10} fill="currentColor" />
              <span className="text-[11px]">{game.rating}</span>
            </span>
          )}
        </div>
      </div>
    </>
  );

  const sharedClassName = `card-hover group flex flex-col overflow-hidden rounded-xl border bg-surface transition-colors ${
    selectable && selected ? "border-accent ring-2 ring-accent/40" : "border-border"
  }`;

  if (selectable) {
    return (
      <motion.button
        type="button"
        onClick={() => onToggleSelect?.(game.id)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 350, damping: 22 }}
        className={`${sharedClassName} w-full text-left`}
      >
        {inner}
      </motion.button>
    );
  }

  return (
    <MotionLink
      href={`/library/${game.id}`}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", stiffness: 350, damping: 22 }}
      className={sharedClassName}
    >
      {inner}
    </MotionLink>
  );
}
