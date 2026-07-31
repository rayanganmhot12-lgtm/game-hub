"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { X, ChevronLeft, ChevronRight, Sparkles, Clock, Library, Trophy, Gem, Crown } from "lucide-react";
import type { RecapData } from "@/lib/recap";
import { formatPlaytime } from "@/lib/format";

interface Slide {
  icon: typeof Sparkles;
  content: React.ReactNode;
}

export default function RecapSlideshow({ recap }: { recap: RecapData }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);

  const sinceLabel = new Date(recap.trackingSince).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  const slides: Slide[] = [
    {
      icon: Sparkles,
      content: (
        <>
          <h2 className="text-3xl font-bold text-foreground">Your Game Hub Recap</h2>
          <p className="mt-3 text-muted">Tracking your library since {sinceLabel}.</p>
        </>
      ),
    },
    {
      icon: Clock,
      content: (
        <>
          <p className="text-sm text-muted">You&apos;ve played</p>
          <p className="mt-2 text-5xl font-extrabold text-gradient">{formatPlaytime(recap.totalPlaytimeMinutes)}</p>
          <p className="mt-3 text-muted">across your entire library.</p>
        </>
      ),
    },
    ...(recap.mostPlayedGame
      ? [
          {
            icon: Crown,
            content: (
              <>
                <p className="text-sm text-muted">Your most played game is</p>
                {recap.mostPlayedGame.coverImageUrl && (
                  <div className="relative mx-auto mt-4 h-40 w-28 overflow-hidden rounded-xl border border-border">
                    <Image
                      src={recap.mostPlayedGame.coverImageUrl}
                      alt={recap.mostPlayedGame.title}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                )}
                <p className="mt-4 text-2xl font-bold text-foreground">{recap.mostPlayedGame.title}</p>
                <p className="mt-1 text-muted">{formatPlaytime(recap.mostPlayedGame.playtimeMinutes)} played</p>
              </>
            ),
          },
        ]
      : []),
    {
      icon: Library,
      content: (
        <>
          <p className="text-sm text-muted">Your library holds</p>
          <p className="mt-2 text-5xl font-extrabold text-gradient">{recap.totalGames}</p>
          <p className="mt-3 text-muted">games across all connected platforms.</p>
        </>
      ),
    },
    ...(recap.achievementsAvailable > 0
      ? [
          {
            icon: Trophy,
            content: (
              <>
                <p className="text-sm text-muted">You&apos;ve unlocked</p>
                <p className="mt-2 text-5xl font-extrabold text-gradient">
                  {recap.achievementsUnlocked} / {recap.achievementsAvailable}
                </p>
                <p className="mt-3 text-muted">achievements in games we&apos;ve tracked.</p>
              </>
            ),
          },
        ]
      : []),
    {
      icon: Gem,
      content: (
        <>
          <p className="text-sm text-muted">Just from using Game Hub, you&apos;ve earned</p>
          <p className="mt-2 text-5xl font-extrabold text-gradient">{recap.lifetimePointsEarned}</p>
          <p className="mt-3 text-muted">points to spend in the Store.</p>
        </>
      ),
    },
    {
      icon: Sparkles,
      content: (
        <>
          <h2 className="text-2xl font-bold text-foreground">Thanks for using Game Hub</h2>
          <p className="mt-3 text-muted">Here&apos;s to many more hours played.</p>
        </>
      ),
    },
  ];

  const slide = slides[index];
  const Icon = slide.icon;

  function next() {
    setIndex((i) => Math.min(slides.length - 1, i + 1));
  }
  function prev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-4">
      <button
        onClick={() => router.push("/dashboard")}
        className="btn-ghost absolute right-6 top-6"
        title="Close recap"
      >
        <X size={18} />
      </button>

      <div className="flex w-full max-w-md flex-col items-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="panel flex w-full flex-col items-center p-10"
          >
            <div className="icon-badge mb-4 h-14 w-14">
              <Icon size={26} />
            </div>
            {slide.content}
          </motion.div>
        </AnimatePresence>

        <div className="mt-6 flex items-center gap-4">
          <button onClick={prev} disabled={index === 0} className="btn-ghost disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          <div className="flex gap-1.5">
            {slides.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${i === index ? "bg-accent" : "bg-surface-2"}`}
              />
            ))}
          </div>
          <button onClick={next} disabled={index === slides.length - 1} className="btn-ghost disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
