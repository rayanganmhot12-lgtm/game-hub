import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeFriendCode } from "@/lib/friendCode";

export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { code } = await params;
  const peerFriendCode = normalizeFriendCode(code);

  const messages = await prisma.chatMessage.findMany({
    where: { userId: user.id, peerFriendCode },
    orderBy: { sentAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { code } = await params;
  const peerFriendCode = normalizeFriendCode(code);
  const body = await request.json();

  const direction = body.direction === "received" ? "received" : "sent";
  const text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  const peerDisplayName = typeof body.peerDisplayName === "string" ? body.peerDisplayName.slice(0, 60) : peerFriendCode;
  const clientId = typeof body.clientId === "string" ? body.clientId : null;

  if (!text.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const message = await prisma.chatMessage.create({
    data: { userId: user.id, peerFriendCode, peerDisplayName, direction, text, clientId },
  });

  return NextResponse.json({ message });
}
