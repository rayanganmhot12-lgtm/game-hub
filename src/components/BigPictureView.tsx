"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { X, Play, Gamepad2 } from "lucide-react";
import type { OwnedGameSummary } from "@/lib/games";
import { formatPlaytime } from "@/lib/format";
import { launchGame } from "@/lib/launchGame";

export default function BigPictureView({ games }: { games: OwnedGameSummary[] }) {
  const router = useRouter();
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [columns, setColumns] = useState(5);
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    function measure() {
      const container = gridRef.current;
      if (!container || container.children.length < 2) return;
      const children = Array.from(container.children) as HTMLElement[];
      const firstTop = children[0].offsetTop;
      let count = 0;
      for (const child of children) {
        if (child.offsetTop === firstTop) count++;
        else break;
      }
      setColumns(count || 1);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [games.length]);

  useEffect(() => {
    cardRefs.current[focusedIndex]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedIndex]);

  useEffect(() => {
    function launchFocused() {
      const game = games[focusedIndex];
      if (game?.platformGameId) {
        launchGame(game.platform, game.platformGameId);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        router.push("/dashboard");
        return;
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        launchFocused();
        return;
      }
      let next = focusedIndex;
      if (e.key === "ArrowRight") next = Math.min(games.length - 1, focusedIndex + 1);
      else if (e.key === "ArrowLeft") next = Math.max(0, focusedIndex - 1);
      else if (e.key === "ArrowDown") next = Math.min(games.length - 1, focusedIndex + columns);
      else if (e.key === "ArrowUp") next = Math.max(0, focusedIndex - columns);
      else return;
      e.preventDefault();
      setFocusedIndex(next);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [focusedIndex, columns, games, router]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <Gamepad2 className="text-accent-bright glow-accent-text" size={28} />
          <h1 className="text-2xl font-bold text-foreground">Big Picture</h1>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="btn-ghost !text-base"
          title="Exit Big Picture (Esc)"
        >
          <X size={18} />
          Exit
        </button>
      </div>

      {games.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-muted">
          Nothing in your library yet.
        </div>
      ) : (
        <div ref={gridRef} className="grid flex-1 auto-rows-max grid-cols-3 gap-6 overflow-y-auto px-8 pb-10 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {games.map((game, index) => {
            const focused = index === focusedIndex;
            return (
              <div
                key={game.id}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                onMouseEnter={() => setFocusedIndex(index)}
                onClick={() => {
                  if (game.platformGameId) {
                    launchGame(game.platform, game.platformGameId);
                  }
                }}
                className={`group flex cursor-pointer flex-col overflow-hidden rounded-2xl border-2 bg-surface transition-all duration-150 ${
                  focused ? "scale-105 border-accent shadow-[0_0_0_4px_rgba(var(--accent-rgb),0.35)]" : "border-transparent"
                }`}
              >
                <div className="relative aspect-[2/3] w-full bg-surface-2">
                  {game.coverImageUrl ? (
                    <Image
                      src={game.coverImageUrl}
                      alt={game.title}
                      fill
                      unoptimized
                      sizes="(max-width: 768px) 33vw, 20vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-muted">No cover</div>
                  )}
                  {focused && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <div className="icon-badge h-14 w-14">
                        <Play size={26} fill="currentColor" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="line-clamp-2 text-base font-semibold text-foreground">{game.title}</p>
                  <p className="mt-1 text-sm text-muted">{formatPlaytime(game.playtimeMinutes)} played</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-8 pb-5 text-center text-xs text-muted">
        Arrow keys to move · Enter to launch · Esc to exit
      </div>
    </div>
  );
}
