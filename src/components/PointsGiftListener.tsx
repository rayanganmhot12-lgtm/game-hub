"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { listenForPointsGifts, removePointsGift } from "@/lib/pointsRealtime";
import { useToast } from "@/context/ToastContext";
import { logNotification } from "@/lib/notifications";

export default function PointsGiftListener({ myCode }: { myCode: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    return listenForPointsGifts(myCode, async (gift, giftId) => {
      const res = await fetch("/api/store/gift-received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: gift.amount }),
      });
      if (res.ok) {
        showToast(`${gift.fromDisplayName} sent you ${gift.amount} points!`, "success");
        logNotification("points_gift", `${gift.fromDisplayName} sent you ${gift.amount} points.`);
        router.refresh();
      }
      await removePointsGift(myCode, giftId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  return null;
}
