"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Unlock } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function DevCheatsPanel() {
  const { showToast } = useToast();
  const router = useRouter();
  const [amount, setAmount] = useState(500);
  const [granting, setGranting] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  async function handleGrant() {
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a positive amount.", "error");
      return;
    }
    setGranting(true);
    try {
      const res = await fetch("/api/store/self-grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.floor(amount) }),
      });
      if (!res.ok) throw new Error("Couldn't grant points.");
      showToast(`+${amount} points.`, "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't grant points.", "error");
    } finally {
      setGranting(false);
    }
  }

  async function handleUnlockAll() {
    setUnlocking(true);
    try {
      const res = await fetch("/api/store/unlock-all", { method: "POST" });
      if (!res.ok) throw new Error("Couldn't unlock cosmetics.");
      showToast("All cosmetics unlocked.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't unlock cosmetics.", "error");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <Sparkles size={13} className="text-accent-bright" />
        Developer Cheats
      </h3>
      <p className="mb-3 text-xs text-muted">Only visible to you — no cost, local to your own account.</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 gap-2">
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input-field w-28"
          />
          <button onClick={handleGrant} disabled={granting} className="btn-primary flex-1">
            Give Myself Points
          </button>
        </div>
        <button onClick={handleUnlockAll} disabled={unlocking} className="btn-ghost">
          <Unlock size={14} />
          Unlock All Cosmetics
        </button>
      </div>
    </div>
  );
}
