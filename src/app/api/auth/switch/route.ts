import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, type SavedAccount } from "@/lib/session";
import { getDisplayName } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const targetUserId = typeof body?.userId === "string" ? body.userId : "";

  const saved = session.savedAccounts ?? [];
  const target = saved.find((a) => a.userId === targetUserId);
  if (!target) {
    return NextResponse.json({ error: "That account isn't saved on this device." }, { status: 400 });
  }

  const targetExists = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!targetExists) {
    // Stale entry (account deleted since being saved) — drop it rather
    // than switching into a dead account.
    session.savedAccounts = saved.filter((a) => a.userId !== targetUserId);
    await session.save();
    return NextResponse.json({ error: "That account no longer exists." }, { status: 400 });
  }

  const current = await prisma.user.findUnique({ where: { id: session.userId }, include: { accounts: true } });
  const nextSaved: SavedAccount[] = saved.filter((a) => a.userId !== targetUserId);
  if (current) {
    nextSaved.push({ userId: current.id, email: current.email, displayName: getDisplayName(current) });
  }

  session.savedAccounts = nextSaved;
  session.userId = target.userId;
  await session.save();

  return NextResponse.json({ ok: true });
}
