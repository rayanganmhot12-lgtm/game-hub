import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { enabled, color1, color2 } = body as Record<string, unknown>;

  const data: { nameEffect?: string | null; nameEffectColor1?: string; nameEffectColor2?: string } = {};
  if (typeof enabled === "boolean") {
    data.nameEffect = enabled ? "gradient-cycle" : null;
  }
  if (typeof color1 === "string" || typeof color2 === "string") {
    if (typeof color1 !== "string" || typeof color2 !== "string" || !HEX_COLOR.test(color1) || !HEX_COLOR.test(color2)) {
      return NextResponse.json({ error: "Enter two valid hex colors." }, { status: 400 });
    }
    data.nameEffectColor1 = color1;
    data.nameEffectColor2 = color2;
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { nameEffect: true, nameEffectColor1: true, nameEffectColor2: true },
  });

  return NextResponse.json(updated);
}
