"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { listenForPointsWithdrawals, removePointsWithdrawal } from "@/lib/pointsRealtime";
import { useToast } from "@/context/ToastContext";
import { logNotification } from "@/lib/notifications";

export default function PointsWithdrawalListener({ myCode }: { myCode: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    return listenForPointsWithdrawals(myCode, async (withdrawal, id) => {
      const res = await fetch("/api/store/withdrawal-received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: withdrawal.amount }),
      });
      if (res.ok) {
        showToast(`${withdrawal.fromDisplayName} took back ${withdrawal.amount} points.`, "info");
        logNotification("points_withdrawal", `${withdrawal.fromDisplayName} took back ${withdrawal.amount} points.`);
        router.refresh();
      }
      await removePointsWithdrawal(myCode, id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  return null;
}
