import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = [
  "friend_request",
  "friend_accept",
  "group_invite",
  "group_message",
  "group_mention",
  "points_gift",
  "cosmetic_gift",
  "warning",
  "announcement",
];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return NextResponse.json({ notifications });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const type = typeof body?.type === "string" ? body.type : "";
  const message = typeof body?.message === "string" ? body.message.slice(0, 300) : "";
  if (!VALID_TYPES.includes(type) || !message) {
    return NextResponse.json({ error: "Invalid notification" }, { status: 400 });
  }

  const notification = await prisma.notification.create({
    data: { userId: user.id, type, message },
  });

  return NextResponse.json({ notification });
}

// Marks every unread notification as read (called when the bell dropdown opens).
export async function PATCH() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await prisma.notification.updateMany({
    where: { userId: user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await prisma.notification.deleteMany({ where: { userId: user.id } });

  return NextResponse.json({ ok: true });
}
