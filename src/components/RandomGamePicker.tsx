"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Dices, RotateCcw } from "lucide-react";
import { PlayButton } from "@/components/PlayButton";
import { useToast } from "@/context/ToastContext";

interface PickedGame {
  id: string;
  title: string;
  platform: string;
  platformGameId?: string;
  coverImageUrl?: string | null;
}

export default function RandomGamePicker() {
  const [picked, setPicked] = useState<PickedGame | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  async function pick() {
    setLoading(true);
    try {
      const res = await fetch("/api/games/random");
      const data = await res.json();
      if (!data.game) {
        showToast("No games in your library yet.", "info");
        setPicked(null);
        return;
      }
      setPicked(data.game);
      setReason(data.reason);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <Dices size={16} className="text-accent-bright" />
        <h2 className="text-sm font-semibold text-foreground">What should I play?</h2>
      </div>

      {!picked ? (
        <button onClick={pick} disabled={loading} className="btn-primary w-full">
          {loading ? "Picking…" : "Pick something for me"}
        </button>
      ) : (
        <div className="flex gap-3">
          <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-md bg-surface-2">
            {picked.coverImageUrl && (
              <Image src={picked.coverImageUrl} alt={picked.title} fill unoptimized className="object-cover" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <div>
              <Link
                href={`/library/${picked.id}`}
                className="line-clamp-1 text-sm font-medium text-foreground hover:text-accent-bright"
              >
                {picked.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted">{reason}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              {picked.platformGameId && (
                <PlayButton
                  platform={picked.platform}
                  platformGameId={picked.platformGameId}
                  className="btn-primary !px-2.5 !py-1 !text-xs"
                />
              )}
              <button onClick={pick} disabled={loading} className="btn-ghost !px-2.5 !py-1 !text-xs">
                <RotateCcw size={12} />
                Try another
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
