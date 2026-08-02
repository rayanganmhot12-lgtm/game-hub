import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { priceFor, PLUS_ITEM_ID } from "@/lib/cosmetics";
import { getPricedCatalog } from "@/lib/storePricesServer";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const itemId = body.itemId;
  // Priced catalog, not the raw one — the developer's overrides are what
  // this purchase has to be charged at.
  const item = typeof itemId === "string" ? getPricedCatalog().find((c) => c.id === itemId) : undefined;
  if (!item) {
    return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  }
  if (item.adminOnly) {
    return NextResponse.json({ error: "This item isn't purchasable." }, { status: 400 });
  }

  const owned: string[] = user.unlockedCosmetics ? JSON.parse(user.unlockedCosmetics) : [];
  if (owned.includes(item.id)) {
    return NextResponse.json({ error: "You already own this item." }, { status: 400 });
  }
  const price = priceFor(item, owned.includes(PLUS_ITEM_ID));
  if (user.points < price) {
    return NextResponse.json({ error: "Not enough points yet." }, { status: 400 });
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      points: { decrement: price },
      unlockedCosmetics: JSON.stringify([...owned, item.id]),
    },
    select: { points: true, unlockedCosmetics: true },
  });

  return NextResponse.json({ ok: true, points: updated.points, unlockedCosmetics: updated.unlockedCosmetics });
}
