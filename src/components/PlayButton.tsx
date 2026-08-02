"use client";

import { Play } from "lucide-react";
import { launchGame as launch } from "@/lib/launchGame";

export function PlayButton({
  platform,
  platformGameId,
  className,
}: {
  platform: string;
  platformGameId: string;
  className?: string;
}) {
  if (platform !== "STEAM") return null;

  return (
    <button
      onClick={() => launch(platform, platformGameId)}
      title="Launch via Steam"
      className={className ?? "btn-primary"}
    >
      <Play size={16} fill="currentColor" />
      Play
    </button>
  );
}

export function PlayIconOverlay({
  platform,
  platformGameId,
}: {
  platform: string;
  platformGameId: string;
}) {
  if (platform !== "STEAM") return null;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        launch(platform, platformGameId);
      }}
      title="Launch via Steam"
      className="absolute bottom-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-accent text-black opacity-0 transition-opacity hover:bg-accent-bright active:scale-90 group-hover:opacity-100"
    >
      <Play size={14} fill="currentColor" />
    </button>
  );
}
