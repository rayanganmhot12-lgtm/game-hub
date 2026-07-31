import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Called once, right after accepting a group invite — creates this
// installation's own local copy of the group (same shared groupId as
// everyone else's).
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const groupId = typeof body.groupId === "string" ? body.groupId : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!groupId || !name) {
    return NextResponse.json({ error: "groupId and name are required" }, { status: 400 });
  }

  const group = await prisma.group.upsert({
    where: { userId_groupId: { userId: user.id, groupId } },
    update: { name },
    create: { userId: user.id, groupId, name },
    include: { members: true },
  });

  return NextResponse.json({ group });
}
