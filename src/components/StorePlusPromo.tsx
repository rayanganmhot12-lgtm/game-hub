"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gem, Check, Lock, Sparkles } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { PLUS_ITEM_ID, type CosmeticItem } from "@/lib/cosmetics";
import PlusCelebration from "@/components/PlusCelebration";

export default function StorePlusPromo({
  catalog,
  points,
  unlockedCosmetics,
}: {
  catalog: CosmeticItem[];
  points: number;
  unlockedCosmetics: string[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const plusItem = catalog.find((c) => c.id === PLUS_ITEM_ID);
  const hasPlus = plusItem ? unlockedCosmetics.includes(plusItem.id) : false;

  if (!plusItem) return null;

  async function purchase() {
    if (!plusItem) return;
    setBusy(true);
    try {
      const res = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: plusItem.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Couldn't unlock that item.", "error");
      } else {
        setCelebrating(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-accent/40 bg-gradient-to-br from-accent/10 via-surface to-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Sparkles size={16} className="text-accent-bright" />
              {plusItem.name}
            </p>
            <p className="mt-1 max-w-sm text-xs text-muted">{plusItem.description}</p>
          </div>
          {hasPlus ? (
            <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-accent-bright">
              <Check size={14} />
              Active
            </span>
          ) : (
            <button
              onClick={purchase}
              disabled={busy || points < plusItem.cost}
              className="btn-primary shrink-0 disabled:opacity-50"
              title={points < plusItem.cost ? "Not enough points yet" : undefined}
            >
              {points < plusItem.cost && <Lock size={13} />}
              {plusItem.cost} pts
            </button>
          )}
        </div>
      </div>

      {/* The balance decides what you can buy on this page, so it reads as a
          balance rather than a small chip tucked into a corner. */}
      <div className="panel flex items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="icon-badge h-10 w-10 shrink-0">
            <Gem size={18} />
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted">Your balance</p>
            <p className="stat-value mt-0.5 !text-2xl">{points}</p>
          </div>
        </div>
        <p className="max-w-[16rem] text-right text-xs leading-relaxed text-muted">
          Earned by playing, unlocking achievements, and completing missions.
        </p>
      </div>

      {celebrating && <PlusCelebration onDone={() => setCelebrating(false)} />}
    </>
  );
}
