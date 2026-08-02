"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { listenForCosmeticRevokes, removeCosmeticRevoke } from "@/lib/cosmeticGiftRealtime";
import { useToast } from "@/context/ToastContext";
import { logNotification } from "@/lib/notifications";

export default function CosmeticRevokeListener({ myCode }: { myCode: string }) {
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    return listenForCosmeticRevokes(myCode, async (revoke, revokeId) => {
      const res = await fetch("/api/store/cosmetic-revoke-received", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: revoke.itemId }),
      });
      if (res.ok) {
        showToast(`${revoke.fromDisplayName} took back "${revoke.itemName}".`, "info");
        logNotification("cosmetic_revoke", `${revoke.fromDisplayName} took back "${revoke.itemName}".`);
        router.refresh();
      }
      await removeCosmeticRevoke(myCode, revokeId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  return null;
}
