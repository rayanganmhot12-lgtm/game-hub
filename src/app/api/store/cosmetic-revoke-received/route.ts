import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCosmetic, PLUS_ITEM_ID } from "@/lib/cosmetics";

// The mirror of cosmetic-gift-received: takes an item back off the current,
// receiving user's own local unlocked list after the developer account asked
// for it via the Firebase relay.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const itemId = typeof body.itemId === "string" ? body.itemId : "";
  const item = getCosmetic(itemId);
  if (!item) {
    return NextResponse.json({ error: "Unknown item" }, { status: 400 });
  }

  const owned: string[] = user.unlockedCosmetics ? JSON.parse(user.unlockedCosmetics) : [];
  if (!owned.includes(itemId)) {
    return NextResponse.json({ ok: true, alreadyGone: true });
  }

  const data: {
    unlockedCosmetics: string;
    equippedFrame?: null;
    equippedBadge?: null;
    equippedBanner?: null;
    pinnedCosmeticId?: null;
    accentColor?: null;
  } = { unlockedCosmetics: JSON.stringify(owned.filter((id) => id !== itemId)) };

  // Losing an item you're currently wearing has to take it off too, or the
  // profile would keep rendering a cosmetic that's no longer owned.
  if (item.type === "frame" && user.equippedFrame === itemId) data.equippedFrame = null;
  if (item.type === "badge" && user.equippedBadge === itemId) data.equippedBadge = null;
  if (item.type === "banner" && user.equippedBanner === itemId) data.equippedBanner = null;
  if (user.pinnedCosmeticId === itemId) data.pinnedCosmeticId = null;

  // A custom accent color is a Plus-only perk (see /api/profile), so losing
  // Plus drops it as well. An already-uploaded GIF avatar/banner is left
  // alone on purpose — that's the user's own content, and the Plus gate is
  // on uploading a new one, not on keeping what's already there.
  if (itemId === PLUS_ITEM_ID && user.accentColor) data.accentColor = null;

  await prisma.user.update({ where: { id: user.id }, data });

  return NextResponse.json({ ok: true });
}
