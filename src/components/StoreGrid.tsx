"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock, Gem } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { priceFor, PLUS_ITEM_ID, type CosmeticItem } from "@/lib/cosmetics";
import { CosmeticFrame, CosmeticBadge, CosmeticBanner } from "@/components/CosmeticFrame";

export default function StoreGrid({
  type,
  catalog,
  points,
  unlockedCosmetics,
  equippedFrame,
  equippedBadge,
  equippedBanner,
}: {
  type: CosmeticItem["type"];
  catalog: CosmeticItem[];
  points: number;
  unlockedCosmetics: string[];
  equippedFrame: string | null;
  equippedBadge: string | null;
  equippedBanner: string | null;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function purchase(item: CosmeticItem) {
    setBusyId(item.id);
    try {
      const res = await fetch("/api/store/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Couldn't unlock that item.", "error");
      } else {
        showToast(`Unlocked ${item.name}!`, "success");
        router.refresh();
      }
    } finally {
      setBusyId(null);
    }
  }

  async function equip(item: CosmeticItem, currentlyEquipped: boolean) {
    setBusyId(item.id);
    try {
      await fetch("/api/store/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: currentlyEquipped ? null : item.id, type: item.type }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function equippedIdFor(itemType: CosmeticItem["type"]) {
    if (itemType === "frame") return equippedFrame;
    if (itemType === "badge") return equippedBadge;
    return equippedBanner;
  }

  // Sized for the display stage below rather than the old 56px strip — these
  // are the products, and at the previous scale a frame's glow and a banner's
  // animation were essentially invisible.
  function previewFor(item: CosmeticItem) {
    if (item.type === "frame") {
      return (
        <CosmeticFrame frameId={item.id}>
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-surface-2 to-surface" />
        </CosmeticFrame>
      );
    }
    if (item.type === "banner") {
      return (
        // The width matters, and its absence is why these previews were blank.
        // The stage is a flex row, so CosmeticBanner's wrapper is a flex item
        // sized to its content — while that content asks for `w-full`, which
        // is a percentage of the wrapper. The circle resolves to zero:
        // measured, the shimmer and aurora wrappers came out at 0.0px and the
        // neon-glow one at 6.0px, its two 3px borders with nothing between
        // them, which is the hairline that showed instead of a banner. Every
        // other place a banner is drawn puts it in a block with a real width;
        // this one didn't.
        <div className="w-full">
          <CosmeticBanner bannerId={item.id}>
            {/* Lit rather than near-black, because two of these are overlays.
                banner-aurora composites with mix-blend-mode: overlay, which
                over a dark backdrop stays dark — on a profile it sits over
                someone's actual banner image, so the preview has to stand in
                for one rather than for a black rectangle. */}
            <div className="h-24 w-full rounded-lg bg-gradient-to-br from-slate-600 via-slate-700 to-surface-2" />
          </CosmeticBanner>
        </div>
      );
    }
    return (
      <span className="scale-[1.6]">
        <CosmeticBadge badgeId={item.id} />
      </span>
    );
  }

  const hasPlus = unlockedCosmetics.includes(PLUS_ITEM_ID);
  const itemsForType = catalog.filter((c) => c.type === type);

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {itemsForType.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          owned={unlockedCosmetics.includes(item.id)}
          equipped={equippedIdFor(item.type) === item.id}
          points={points}
          price={priceFor(item, hasPlus)}
          discounted={hasPlus}
          busy={busyId === item.id}
          onPurchase={() => purchase(item)}
          onEquip={(currentlyEquipped) => equip(item, currentlyEquipped)}
          preview={previewFor(item)}
        />
      ))}
    </div>
  );
}

function ItemCard({
  item,
  owned,
  equipped,
  points,
  price,
  discounted,
  busy,
  onPurchase,
  onEquip,
  preview,
}: {
  item: CosmeticItem;
  owned: boolean;
  equipped: boolean;
  points: number;
  price: number;
  discounted: boolean;
  busy: boolean;
  onPurchase: () => void;
  onEquip: (currentlyEquipped: boolean) => void;
  preview: React.ReactNode;
}) {
  const canAfford = points >= price;
  const short = price - points;

  return (
    <div
      className={`panel panel-hover flex flex-col overflow-hidden ${
        equipped ? "ring-1 ring-accent/50" : ""
      }`}
    >
      {/* A display stage rather than a cramped strip: the item gets its own
          lit area at the top of the card, the way a product shot would, with
          the price and ownership called out over it instead of hidden inside
          the button text. */}
      <div className="relative flex min-h-[9.5rem] items-center justify-center bg-[radial-gradient(120%_90%_at_50%_15%,rgba(var(--accent-rgb),0.12),transparent_65%)] px-5 py-6">
        {preview}

        <span className="absolute left-3 top-3">
          {owned ? (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
              <Check size={11} />
              Owned
            </span>
          ) : (
            <span
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums ${
                canAfford ? "bg-accent/20 text-accent-bright" : "bg-surface-2/80 text-muted"
              }`}
            >
              <Gem size={10} />
              {discounted && <span className="font-normal line-through opacity-50">{item.cost}</span>}
              {price}
            </span>
          )}
        </span>

        {equipped && (
          <span className="absolute right-3 top-3 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold text-accent-bright">
            Equipped
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 border-t border-border/50 bg-gradient-to-b from-surface-2/50 to-surface p-4">
        <div>
          <p className="text-sm font-semibold text-foreground">{item.name}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{item.description}</p>
        </div>

        <div className="mt-auto">
          {owned ? (
            <button
              onClick={() => onEquip(equipped)}
              disabled={busy}
              className={`w-full ${equipped ? "btn-ghost !justify-center" : "btn-primary"}`}
            >
              {equipped ? "Unequip" : "Equip"}
            </button>
          ) : canAfford ? (
            <button onClick={onPurchase} disabled={busy} className="btn-primary w-full disabled:opacity-50">
              {busy ? "Unlocking…" : "Unlock"}
            </button>
          ) : (
            // Saying how far short you are is more use than a dead button —
            // it turns "no" into a target.
            <div className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-surface-2/40 px-3 py-2 text-xs text-muted">
              <Lock size={12} />
              {short} more {short === 1 ? "point" : "points"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
