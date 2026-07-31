import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeFriendCode } from "@/lib/friendCode";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { code } = await params;
  const friendCode = normalizeFriendCode(code);

  await prisma.friend.deleteMany({ where: { userId: user.id, friendCode } });
  return NextResponse.json({ ok: true });
}
