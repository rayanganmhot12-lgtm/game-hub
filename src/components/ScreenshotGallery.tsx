"use client";

import { useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { SteamScreenshot } from "@/lib/steamStore";

export default function ScreenshotGallery({ screenshots }: { screenshots: SteamScreenshot[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (screenshots.length === 0) return null;

  function close() {
    setOpenIndex(null);
  }

  function step(delta: number) {
    setOpenIndex((current) => {
      if (current === null) return current;
      return (current + delta + screenshots.length) % screenshots.length;
    });
  }

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {screenshots.map((shot, i) => (
          <button
            key={shot.id}
            onClick={() => setOpenIndex(i)}
            className="relative h-20 w-36 shrink-0 overflow-hidden rounded-lg border border-border transition-transform duration-150 hover:scale-[1.03] hover:border-accent/40"
          >
            <Image src={shot.thumbnail} alt="" fill unoptimized className="object-cover" />
          </button>
        ))}
      </div>

      <AnimatePresence>
        {openIndex !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          >
            <button onClick={close} className="absolute right-4 top-4 text-white/80 hover:text-white">
              <X size={28} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                step(-1);
              }}
              className="absolute left-4 text-white/70 hover:text-white"
            >
              <ChevronLeft size={36} />
            </button>

            <motion.div
              key={openIndex}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative aspect-video w-full max-w-4xl"
            >
              <Image
                src={screenshots[openIndex].full}
                alt=""
                fill
                unoptimized
                className="object-contain"
                sizes="90vw"
              />
            </motion.div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                step(1);
              }}
              className="absolute right-4 text-white/70 hover:text-white"
            >
              <ChevronRight size={36} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
