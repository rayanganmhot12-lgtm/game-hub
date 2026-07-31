import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeFriendCode } from "@/lib/friendCode";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const friends = await prisma.friend.findMany({
    where: { userId: user.id },
    orderBy: { friendDisplayName: "asc" },
  });

  return NextResponse.json({ friends });
}

// Called after either side of the request/accept handshake resolves — each
// installation just records its own copy of the friendship locally.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const friendCode = typeof body.friendCode === "string" ? normalizeFriendCode(body.friendCode) : "";
  const friendDisplayName = typeof body.friendDisplayName === "string" ? body.friendDisplayName.slice(0, 60) : "";
  const friendBadge = typeof body.friendBadge === "string" ? body.friendBadge.slice(0, 60) : null;

  if (!friendCode || !friendDisplayName) {
    return NextResponse.json({ error: "friendCode and friendDisplayName are required" }, { status: 400 });
  }
  if (friendCode === user.friendCode) {
    return NextResponse.json({ error: "You can't add yourself." }, { status: 400 });
  }

  const friend = await prisma.friend.upsert({
    where: { userId_friendCode: { userId: user.id, friendCode } },
    update: { friendDisplayName, friendBadge },
    create: { userId: user.id, friendCode, friendDisplayName, friendBadge },
  });

  return NextResponse.json({ friend });
}
