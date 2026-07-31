import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCosmetic } from "@/lib/cosmetics";

// Applies a cosmetic gifted by the developer account (relayed via Firebase)
// to the current, receiving user's own local unlocked-cosmetics list.
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
  if (owned.includes(itemId)) {
    return NextResponse.json({ ok: true, alreadyOwned: true });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { unlockedCosmetics: JSON.stringify([...owned, itemId]) },
  });

  return NextResponse.json({ ok: true });
}
