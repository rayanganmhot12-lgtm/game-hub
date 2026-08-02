"use client";

import { useState } from "react";
import { PackageOpen } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { sendCosmeticRevoke } from "@/lib/cosmeticGiftRealtime";
import { COSMETIC_CATALOG } from "@/lib/cosmetics";

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
}

export default function RevokeCosmeticPanel({
  myCode,
  myDisplayName,
  friends,
}: {
  myCode: string;
  myDisplayName: string;
  friends: Friend[];
}) {
  const { showToast } = useToast();
  const [targetCode, setTargetCode] = useState("");
  const [itemId, setItemId] = useState("");
  const [sending, setSending] = useState(false);

  async function handleRevoke() {
    if (!targetCode) {
      showToast("Pick a friend.", "error");
      return;
    }
    const item = COSMETIC_CATALOG.find((c) => c.id === itemId && !c.adminOnly);
    if (!item) {
      showToast("Pick an item.", "error");
      return;
    }
    setSending(true);
    try {
      await sendCosmeticRevoke(targetCode, item.id, item.name, myCode, myDisplayName);
      const friend = friends.find((f) => f.friendCode === targetCode);
      showToast(`Taking "${item.name}" back from ${friend?.friendDisplayName ?? "friend"}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't revoke item.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <PackageOpen size={13} className="text-accent-bright" />
        Revoke a Cosmetic
      </h3>
      <p className="mb-3 text-xs text-muted">
        Developer-only — takes an item (Game Hub Plus included) back off a friend, and unequips it if they were
        wearing it. Only works once their own app is running and picks up the request.
      </p>

      {!isFirebaseConfigured ? (
        <p className="text-sm text-muted">Needs Firebase set up first — see the README.</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-muted">Add some friends first from the Friends page.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={targetCode} onChange={(e) => setTargetCode(e.target.value)} className="input-field flex-1">
            <option value="">Choose a friend…</option>
            {friends.map((f) => (
              <option key={f.id} value={f.friendCode}>
                {f.friendDisplayName}
              </option>
            ))}
          </select>
          <select value={itemId} onChange={(e) => setItemId(e.target.value)} className="input-field flex-1">
            <option value="">Choose an item…</option>
            {COSMETIC_CATALOG.filter((item) => !item.adminOnly).map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button onClick={handleRevoke} disabled={sending} className="btn-ghost">
            Revoke
          </button>
        </div>
      )}
    </div>
  );
}
