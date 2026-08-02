"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { listenToStorePrices } from "@/lib/storePriceRealtime";

export default function StorePriceSync() {
  const router = useRouter();
  // The relay fires once on subscribe with whatever's already there; only a
  // genuine change after that is worth re-rendering the open page for.
  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    return listenToStorePrices(async (prices) => {
      const serialized = JSON.stringify(prices);
      if (lastSeen.current === serialized) return;
      const isFirstLoad = lastSeen.current === null;
      lastSeen.current = serialized;

      const res = await fetch("/api/store/prices-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (!isFirstLoad && !data.unchanged) router.refresh();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
