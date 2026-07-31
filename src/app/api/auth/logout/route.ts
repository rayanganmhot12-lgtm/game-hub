import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  let saved = session.savedAccounts ?? [];

  // Walk the saved list until we find one that still exists in the DB —
  // an account could have been deleted since it was saved.
  while (saved.length > 0) {
    const [next, ...rest] = saved;
    const exists = await prisma.user.findUnique({ where: { id: next.userId }, select: { id: true } });
    if (exists) {
      session.userId = next.userId;
      session.savedAccounts = rest;
      await session.save();
      return NextResponse.json({ ok: true, promoted: { displayName: next.displayName } });
    }
    saved = rest;
  }

  session.destroy();
  return NextResponse.json({ ok: true });
}
