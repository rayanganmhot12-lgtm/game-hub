"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gem, Check, Lock, Sparkles } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { PLUS_ITEM_ID, priceFor, type CosmeticItem } from "@/lib/cosmetics";
import { CosmeticFrame, CosmeticBadge, CosmeticBanner } from "@/components/CosmeticFrame";
import PlusCelebration from "@/components/PlusCelebration";

const CATEGORIES: { type: CosmeticItem["type"]; label: string }[] = [
  { type: "frame", label: "Avatar Frames" },
  { type: "badge", label: "Badges" },
  { type: "banner", label: "Profile Banners" },
];

export default function StoreGrid({
  catalog,
  points,
  unlockedCosmetics,
  equippedFrame,
  equippedBadge,
  equippedBanner,
}: {
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
  const [activeTab, setActiveTab] = useState<CosmeticItem["type"]>("frame");
  const [celebrating, setCelebrating] = useState(false);

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
      } else if (item.id === PLUS_ITEM_ID) {
        setCelebrating(true);
        router.refresh();
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

  function equippedIdFor(type: CosmeticItem["type"]) {
    if (type === "frame") return equippedFrame;
    if (type === "badge") return equippedBadge;
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

  const plusItem = catalog.find((c) => c.id === PLUS_ITEM_ID);
  const hasPlus = plusItem ? unlockedCosmetics.includes(plusItem.id) : false;
  const tabbedCatalog = catalog.filter((c) => c.type !== "membership");
  const itemsForTab = tabbedCatalog.filter((c) => c.type === activeTab);
  const ownedCountByType = (type: CosmeticItem["type"]) =>
    tabbedCatalog.filter((c) => c.type === type && unlockedCosmetics.includes(c.id)).length;

  return (
    <div className="flex flex-col gap-4">
      {plusItem && (
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
                onClick={() => purchase(plusItem)}
                disabled={busyId === plusItem.id || points < plusItem.cost}
                className="btn-primary shrink-0 disabled:opacity-50"
                title={points < plusItem.cost ? "Not enough points yet" : undefined}
              >
                {points < plusItem.cost && <Lock size={13} />}
                {plusItem.cost} pts
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border bg-surface-2/40 p-1">
          {CATEGORIES.map((cat) => {
            const total = tabbedCatalog.filter((c) => c.type === cat.type).length;
            const active = activeTab === cat.type;
            return (
              <button
                key={cat.type}
                onClick={() => setActiveTab(cat.type)}
                className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active ? "bg-accent text-black" : "text-muted hover:text-foreground"
                }`}
              >
                {cat.label}
                <span className={`ml-1.5 ${active ? "text-black/60" : "text-muted/70"}`}>
                  {ownedCountByType(cat.type)}/{total}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-1.5">
          <Gem size={15} className="text-accent-bright" />
          <span className="text-sm font-semibold text-foreground">{points}</span>
          <span className="text-xs text-muted">points</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {itemsForTab.map((item) => (
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

      {celebrating && <PlusCelebration onDone={() => setCelebrating(false)} />}
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
