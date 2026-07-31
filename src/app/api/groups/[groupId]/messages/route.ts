import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_IMAGE_DATA_URL_LENGTH = 800_000;

export async function GET(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { groupId } = await context.params;

  const group = await prisma.group.findUnique({ where: { userId_groupId: { userId: user.id, groupId } } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const messages = await prisma.groupMessage.findMany({
    where: { groupId: group.id },
    orderBy: { sentAt: "asc" },
  });

  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { groupId } = await context.params;

  const group = await prisma.group.findUnique({ where: { userId_groupId: { userId: user.id, groupId } } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const body = await request.json();
  const senderCode = typeof body.senderCode === "string" ? body.senderCode : "";
  const senderDisplayName = typeof body.senderDisplayName === "string" ? body.senderDisplayName.slice(0, 60) : "";
  const text = typeof body.text === "string" ? body.text.slice(0, 2000) : "";
  const clientId = typeof body.clientId === "string" ? body.clientId : null;
  const channelId = typeof body.channelId === "string" ? body.channelId : null;
  const imageDataUrl =
    typeof body.imageDataUrl === "string" && /^data:image\/(png|jpeg|gif|webp);base64,/.test(body.imageDataUrl)
      ? body.imageDataUrl
      : null;
  if (!senderCode || !senderDisplayName || (!text && !imageDataUrl)) {
    return NextResponse.json({ error: "senderCode, senderDisplayName, and text or an image are required" }, { status: 400 });
  }
  if (imageDataUrl && imageDataUrl.length > MAX_IMAGE_DATA_URL_LENGTH) {
    return NextResponse.json({ error: "That image is too large." }, { status: 400 });
  }

  // The Firebase listener re-fires for the group's entire message history every
  // time a client (re)subscribes (e.g. reopening the chat page) — dedupe by
  // clientId so that doesn't create repeat rows every time someone revisits.
  if (clientId) {
    const existing = await prisma.groupMessage.findFirst({ where: { groupId: group.id, clientId } });
    if (existing) {
      return NextResponse.json({ message: existing });
    }
  }

  const message = await prisma.groupMessage.create({
    data: { groupId: group.id, senderCode, senderDisplayName, text, clientId, channelId, imageDataUrl },
  });

  return NextResponse.json({ message });
}
