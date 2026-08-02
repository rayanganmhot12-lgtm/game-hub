import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getCosmetic } from "@/lib/cosmetics";
import { isValidPrice } from "@/lib/storePrices";
import { readInstallSettings, writeInstallSettings } from "@/lib/installSettings";

// Mirrors the shared store prices off the Firebase relay into this install's
// own settings file, so the purchase route can price an item without a
// network round-trip. Called by every client, not just the developer's —
// Firebase stays a relay here, the local file stays the source of truth.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const prices = (body as { prices?: unknown })?.prices;
  if (typeof prices !== "object" || prices === null || Array.isArray(prices)) {
    return NextResponse.json({ error: "Invalid prices" }, { status: 400 });
  }

  // Anything unrecognised or out of range is dropped rather than rejected:
  // a stale id left on the relay shouldn't stop the valid prices applying.
  const clean: Record<string, number> = {};
  for (const [itemId, cost] of Object.entries(prices as Record<string, unknown>)) {
    if (getCosmetic(itemId) && isValidPrice(cost)) clean[itemId] = cost;
  }

  const current = readInstallSettings().storePrices ?? {};
  const unchanged =
    Object.keys(clean).length === Object.keys(current).length &&
    Object.entries(clean).every(([id, cost]) => current[id] === cost);
  if (unchanged) {
    return NextResponse.json({ ok: true, unchanged: true });
  }

  writeInstallSettings({ storePrices: clean });
  return NextResponse.json({ ok: true });
}
