"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tags, Gem, RotateCcw, Sparkles } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { publishStorePrices } from "@/lib/storePriceRealtime";
import { MAX_STORE_PRICE } from "@/lib/storePrices";
import { COSMETIC_CATALOG, type CosmeticItem } from "@/lib/cosmetics";
import { CosmeticFrame, CosmeticBadge, CosmeticBanner } from "@/components/CosmeticFrame";

// Same visual language as the Store's own item cards, just sized for a
// compact editing grid — the point is recognising the item at a glance.
function ItemPreview({ item }: { item: CosmeticItem }) {
  if (item.type === "frame") {
    return (
      <CosmeticFrame frameId={item.id}>
        <div className="h-11 w-11 rounded-full bg-surface-2" />
      </CosmeticFrame>
    );
  }
  if (item.type === "banner") {
    return (
      <CosmeticBanner bannerId={item.id}>
        <div className="h-11 w-20 rounded-md bg-gradient-to-br from-surface-2 to-surface" />
      </CosmeticBanner>
    );
  }
  if (item.type === "badge") {
    return <CosmeticBadge badgeId={item.id} />;
  }
  return (
    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-black">
      <Sparkles size={20} />
    </span>
  );
}

export default function StorePricesPanel({ catalog }: { catalog: CosmeticItem[] }) {
  const { showToast } = useToast();
  const router = useRouter();
  const editable = catalog.filter((item) => !item.adminOnly);
  const [prices, setPrices] = useState<Record<string, number>>(
    () => Object.fromEntries(editable.map((item) => [item.id, item.cost]))
  );
  const [saving, setSaving] = useState(false);

  // The built-in catalog is the baseline, so "changed" always means "differs
  // from what ships in the code", not "differs from the last save".
  const defaultCostFor = (id: string) => COSMETIC_CATALOG.find((c) => c.id === id)?.cost ?? 0;
  const changedCount = editable.filter((item) => prices[item.id] !== item.cost).length;

  async function handleSave() {
    const invalid = editable.find(
      (item) => !Number.isInteger(prices[item.id]) || prices[item.id] < 0 || prices[item.id] > MAX_STORE_PRICE
    );
    if (invalid) {
      showToast(`"${invalid.name}" needs a whole number between 0 and ${MAX_STORE_PRICE.toLocaleString()}.`, "error");
      return;
    }
    setSaving(true);
    try {
      // Only publish what actually differs from the built-in price, so items
      // left alone keep tracking the catalog if its defaults ever change.
      const overrides: Record<string, number> = {};
      for (const item of editable) {
        if (prices[item.id] !== defaultCostFor(item.id)) overrides[item.id] = prices[item.id];
      }
      await publishStorePrices(overrides);
      showToast("Store prices updated for everyone.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save prices.", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleResetAll() {
    setPrices(Object.fromEntries(editable.map((item) => [item.id, defaultCostFor(item.id)])));
  }

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Tags size={13} className="text-accent-bright" />
        Store Prices
      </h3>
      <p className="mb-3 text-xs text-muted">
        Developer-only — sets what every item costs, for everyone. Saved prices reach other people the next time
        their app is running.
      </p>

      {!isFirebaseConfigured ? (
        <p className="text-sm text-muted">Needs Firebase set up first — see the README.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {editable.map((item) => {
              const changed = prices[item.id] !== item.cost;
              const isDefault = prices[item.id] === defaultCostFor(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 rounded-xl border bg-surface-2/30 p-3 transition-colors ${
                    changed ? "border-accent/60 bg-accent/5" : "border-border/60"
                  }`}
                >
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center">
                    <ItemPreview item={item} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground" title={item.name}>
                      {item.name}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Gem size={12} className="shrink-0 text-accent-bright" />
                      <input
                        type="number"
                        min={0}
                        max={MAX_STORE_PRICE}
                        step={1}
                        value={prices[item.id]}
                        onChange={(e) => setPrices((p) => ({ ...p, [item.id]: Math.floor(Number(e.target.value)) }))}
                        className="input-field w-24 !px-2 !py-1 text-xs"
                      />
                      {!isDefault && (
                        <button
                          onClick={() => setPrices((p) => ({ ...p, [item.id]: defaultCostFor(item.id) }))}
                          title={`Reset to ${defaultCostFor(item.id)} pts`}
                          className="rounded-md p-1 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button onClick={handleSave} disabled={saving || changedCount === 0} className="btn-primary disabled:opacity-50">
              {changedCount === 0 ? "No changes" : `Save ${changedCount} price${changedCount === 1 ? "" : "s"}`}
            </button>
            <button onClick={handleResetAll} disabled={saving} className="btn-ghost">
              <RotateCcw size={14} />
              Reset all to default
            </button>
          </div>
        </>
      )}
    </div>
  );
}
