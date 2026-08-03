"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Monitor, AppWindow, X } from "lucide-react";
import { registerScreenSharePicker } from "@/lib/screenSharePicker";
import type { ScreenShareSource } from "@/lib/desktopBridge";

interface PendingChoice {
  sources: ScreenShareSource[];
  resolve: (source: ScreenShareSource | null) => void;
}

// Electron gives us no picker of its own on Windows, so this is it: the list
// of screens and windows the main process enumerated, with the live thumbnail
// each one reported. Mounted once in the app layout, because the code that
// opens it is the capture path, not any particular screen.
export default function ScreenSharePicker() {
  const [pending, setPending] = useState<PendingChoice | null>(null);

  useEffect(() => {
    registerScreenSharePicker(
      (sources) => new Promise((resolve) => setPending({ sources, resolve }))
    );
    return () => registerScreenSharePicker(null);
  }, []);

  const choose = useCallback(
    (source: ScreenShareSource | null) => {
      // Cleared before resolving: the capture that follows can be slow, and a
      // modal still on screen while the share starts looks like it hung.
      setPending((current) => {
        current?.resolve(source);
        return null;
      });
    },
    []
  );

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") choose(null);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [pending, choose]);

  const screens = pending?.sources.filter((s) => s.kind === "screen") ?? [];
  const windows = pending?.sources.filter((s) => s.kind === "window") ?? [];

  return (
    <AnimatePresence>
      {pending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => choose(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="panel flex max-h-[80vh] w-full max-w-3xl flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between gap-4 border-b border-border/60 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-foreground">Share your screen</h2>
                <p className="mt-0.5 text-xs text-muted">
                  Pick a screen or a single window. Everyone in the call sees it.
                </p>
              </div>
              <button
                onClick={() => choose(null)}
                title="Cancel"
                className="rounded-md p-1.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {pending.sources.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted">
                  Nothing available to share right now.
                </p>
              ) : (
                <>
                  <SourceGroup icon={Monitor} label="Screens" sources={screens} onPick={choose} />
                  <SourceGroup icon={AppWindow} label="Windows" sources={windows} onPick={choose} />
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SourceGroup({
  icon: Icon,
  label,
  sources,
  onPick,
}: {
  icon: typeof Monitor;
  label: string;
  sources: ScreenShareSource[];
  onPick: (source: ScreenShareSource) => void;
}) {
  if (sources.length === 0) return null;
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="section-title mb-3">
        {label}
        <span className="text-muted">{sources.length}</span>
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sources.map((source) => (
          <button
            key={source.id}
            onClick={() => onPick(source)}
            className="group overflow-hidden rounded-xl border border-border bg-surface-2/50 text-left transition-colors hover:border-accent/60 hover:bg-accent/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL
                from desktopCapturer, not an asset next/image can optimise. */}
            <img
              src={source.thumbnailDataUrl}
              alt=""
              className="aspect-video w-full bg-black object-contain"
            />
            <div className="flex items-center gap-2 px-2.5 py-2">
              <Icon size={13} className="shrink-0 text-muted transition-colors group-hover:text-accent-bright" />
              <span className="truncate text-xs text-foreground">{source.name}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
