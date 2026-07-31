import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const VALID_ACTIONS = ["warn", "mute", "timeout", "ban", "unban", "unmute", "reset"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const actions = await prisma.moderationAction.findMany({
    where: { adminUserId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ actions });
}

// Purely a local audit log for the admin's own reference — the actual live
// enforcement state lives in Firebase (every client checks that), this just
// records "what did I do and when" so the admin has a history to review.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json();
  const action = typeof body.action === "string" ? body.action : "";
  if (!VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const targetCode = typeof body.targetCode === "string" ? body.targetCode : "";
  const targetDisplayName = typeof body.targetDisplayName === "string" ? body.targetDisplayName.slice(0, 60) : targetCode;
  if (!targetCode) {
    return NextResponse.json({ error: "targetCode is required" }, { status: 400 });
  }

  const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : null;
  const expiresAt = typeof body.expiresAt === "number" ? new Date(body.expiresAt) : null;

  const entry = await prisma.moderationAction.create({
    data: {
      adminUserId: user.id,
      targetCode,
      targetDisplayName,
      action,
      reason,
      expiresAt,
    },
  });

  return NextResponse.json({ action: entry });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  await prisma.moderationAction.deleteMany({ where: { adminUserId: user.id } });

  return NextResponse.json({ ok: true });
}
