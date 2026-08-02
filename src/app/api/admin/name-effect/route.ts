import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const enabled = body.enabled === true;

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { nameEffect: enabled ? "gradient-cycle" : null },
    select: { nameEffect: true },
  });

  return NextResponse.json({ nameEffect: updated.nameEffect });
}
