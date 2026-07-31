import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { verifyPassword } from "@/lib/password";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const genericError = NextResponse.json({ error: "Invalid email or password." }, { status: 401 });

  if (!email || !password) {
    return genericError;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return genericError;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return genericError;
  }

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  return NextResponse.json({ ok: true });
}
