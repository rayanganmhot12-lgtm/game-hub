"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { listenForCosmeticGifts, removeCosmeticGift } from "@/lib/cosmeticGiftRealtime";
import { useToast } from "@/context/ToastContext";
import { logNotification } from "@/lib/notifications";

export default function CosmeticGiftListener({ myCode }: { myCode: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    return listenForCosmeticGifts(myCode, async (gift, giftId) => {
      const res = await fetch("/api/store/cosmetic-gift-received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: gift.itemId }),
      });
      if (res.ok) {
        showToast(`${gift.fromDisplayName} sent you "${gift.itemName}"!`, "success");
        logNotification("cosmetic_gift", `${gift.fromDisplayName} sent you "${gift.itemName}".`);
        router.refresh();
      }
      await removeCosmeticGift(myCode, giftId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  return null;
}
