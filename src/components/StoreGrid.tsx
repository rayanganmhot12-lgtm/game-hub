"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";
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

  function previewFor(item: CosmeticItem) {
    if (item.type === "frame") {
      return (
        <CosmeticFrame frameId={item.id}>
          <div className="h-12 w-12 rounded-full bg-surface-2" />
        </CosmeticFrame>
      );
    }
    if (item.type === "banner") {
      return (
        <CosmeticBanner bannerId={item.id}>
          <div className="h-12 w-24 rounded-md bg-gradient-to-br from-surface-2 to-surface" />
        </CosmeticBanner>
      );
    }
    return <CosmeticBadge badgeId={item.id} />;
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

  return (
    <div className="panel flex flex-col items-center gap-3 p-4 text-center">
      <div className="flex h-14 items-center justify-center">{preview}</div>
      <div>
        <p className="text-sm font-medium text-foreground">{item.name}</p>
        <p className="mt-0.5 text-xs text-muted">{item.description}</p>
      </div>

      {owned ? (
        <button
          onClick={() => onEquip(equipped)}
          disabled={busy}
          className={`w-full ${equipped ? "btn-ghost" : "btn-primary"}`}
        >
          {equipped ? (
            <>
              <Check size={14} />
              Equipped
            </>
          ) : (
            "Equip"
          )}
        </button>
      ) : (
        <button
          onClick={onPurchase}
          disabled={busy || !canAfford}
          className="btn-primary w-full disabled:opacity-50"
          title={!canAfford ? "Not enough points yet" : undefined}
        >
          {!canAfford && <Lock size={13} />}
          {discounted && <span className="text-black/50 line-through">{item.cost}</span>}
          {price} pts
        </button>
      )}
    </div>
  );
}
