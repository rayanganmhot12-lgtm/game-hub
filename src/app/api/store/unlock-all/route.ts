import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { COSMETIC_CATALOG } from "@/lib/cosmetics";

// Developer-only cheat: unlock every cosmetic in the catalog for your own
// account without spending points.
export async function POST() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const allIds = COSMETIC_CATALOG.map((item) => item.id);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { unlockedCosmetics: JSON.stringify(allIds) },
    select: { unlockedCosmetics: true },
  });

  return NextResponse.json({ unlockedCosmetics: updated.unlockedCosmetics });
}
