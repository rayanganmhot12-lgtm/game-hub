import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, MAX_SAVED_ACCOUNTS, type SavedAccount } from "@/lib/session";
import { verifyPassword } from "@/lib/password";
import { getSavedAccountEntry } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const addAccount = body?.addAccount === true;

  const genericError = NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  if (!email || !password) {
    return genericError;
  }

  const user = await prisma.user.findUnique({ where: { email }, include: { accounts: true } });
  if (!user) {
    return genericError;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return genericError;
  }

  const session = await getSession();

  if (!addAccount) {
    session.userId = user.id;
    session.savedAccounts = [];
    await session.save();
    return NextResponse.json({ ok: true });
  }

  // Adding a second account onto the current session, not replacing it.
  if (session.userId === user.id) {
    return NextResponse.json({ error: "You're already using that account." }, { status: 400 });
  }
  const saved = session.savedAccounts ?? [];
  if (saved.some((a) => a.userId === user.id)) {
    return NextResponse.json(
      { error: "That account's already added — switch to it instead." },
      { status: 400 }
    );
  }
  if (saved.length >= MAX_SAVED_ACCOUNTS) {
    return NextResponse.json({ error: "Remove an account before adding another." }, { status: 400 });
  }

  const nextSaved: SavedAccount[] = [...saved];
  if (session.userId) {
    const currentEntry = await getSavedAccountEntry(session.userId);
    if (currentEntry) {
      nextSaved.push(currentEntry);
    }
  }

  session.savedAccounts = nextSaved;
  session.userId = user.id;
  await session.save();

  return NextResponse.json({ ok: true });
}
