import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Applies points gifted by the developer account (relayed via Firebase) to
// the current, receiving user's own local balance.
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { points: { increment: amount }, lifetimePointsEarned: { increment: amount } },
    select: { points: true },
  });

  return NextResponse.json({ points: updated.points });
}
