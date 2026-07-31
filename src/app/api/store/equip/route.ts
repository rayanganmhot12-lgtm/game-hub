import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCosmetic } from "@/lib/cosmetics";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { itemId, type } = body as { itemId: string | null; type: "frame" | "badge" | "banner" };
  if (type !== "frame" && type !== "badge" && type !== "banner") {
    return NextResponse.json({ error: "Invalid cosmetic type" }, { status: 400 });
  }

  if (itemId !== null) {
    const item = getCosmetic(itemId);
    const owned: string[] = user.unlockedCosmetics ? JSON.parse(user.unlockedCosmetics) : [];
    if (!item || item.type !== type || !owned.includes(itemId)) {
      return NextResponse.json({ error: "You don't own this item." }, { status: 400 });
    }
  }

  const field = type === "frame" ? "equippedFrame" : type === "badge" ? "equippedBadge" : "equippedBanner";
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { [field]: itemId },
    select: { equippedFrame: true, equippedBadge: true, equippedBanner: true },
  });

  return NextResponse.json({ ok: true, ...updated });
}
