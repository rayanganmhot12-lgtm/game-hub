"use client";

import { useState } from "react";
import { MinusCircle } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { sendPointsWithdrawal } from "@/lib/pointsRealtime";

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
}

export default function WithdrawPointsPanel({
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
  const [amount, setAmount] = useState(100);
  const [sending, setSending] = useState(false);

  async function handleWithdraw() {
    if (!targetCode) {
      showToast("Pick a friend.", "error");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast("Enter a positive amount.", "error");
      return;
    }
    setSending(true);
    try {
      await sendPointsWithdrawal(targetCode, Math.floor(amount), myCode, myDisplayName);
      const friend = friends.find((f) => f.friendCode === targetCode);
      showToast(`Requested ${amount} points back from ${friend?.friendDisplayName ?? "friend"}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't withdraw points.", "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h3 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        <MinusCircle size={13} className="text-accent-bright" />
        Withdraw Points
      </h3>
      <p className="mb-3 text-xs text-muted">
        Developer-only — takes points back from a friend&apos;s own balance. Only works once their own app is
        running and picks up the request (never below 0 for them).
      </p>

      {!isFirebaseConfigured ? (
        <p className="text-sm text-muted">Needs Firebase set up first — see the README.</p>
      ) : friends.length === 0 ? (
        <p className="text-sm text-muted">Add some friends first from the Friends page.</p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={targetCode}
            onChange={(e) => setTargetCode(e.target.value)}
            className="input-field flex-1"
          >
            <option value="">Choose a friend…</option>
            {friends.map((f) => (
              <option key={f.id} value={f.friendCode}>
                {f.friendDisplayName}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="input-field w-full sm:w-28"
          />
          <button onClick={handleWithdraw} disabled={sending} className="btn-ghost">
            Withdraw
          </button>
        </div>
      )}
    </div>
  );
}
