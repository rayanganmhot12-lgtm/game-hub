import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Developer-only cheat: grant points straight to your own account, no
// Firebase relay needed since it's the same local database row.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
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
