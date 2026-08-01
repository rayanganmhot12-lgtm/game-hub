import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Applies a points withdrawal requested by the developer account (relayed
// via Firebase) to the current, receiving user's own local balance. Only
// ever deducts from this account's own row — there is no way for any other
// account to touch it directly, since each install owns its own database.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const amount = typeof body.amount === "number" ? Math.floor(body.amount) : 0;
  if (!amount || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const current = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { points: true } });
  const nextPoints = Math.max(0, current.points - amount);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { points: nextPoints },
    select: { points: true },
  });

  return NextResponse.json({ points: updated.points });
}
