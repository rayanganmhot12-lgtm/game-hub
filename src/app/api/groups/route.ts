import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateGroupId } from "@/lib/groupIdServer";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const groups = await prisma.group.findMany({
    where: { userId: user.id },
    include: { members: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ groups });
}

// Creates the group locally for its creator only — invited friends create
// their own local copy (same groupId) once they accept, via /api/groups/join.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 60) : "";
  if (!name) {
    return NextResponse.json({ error: "Group name is required" }, { status: 400 });
  }

  const groupId = generateGroupId();
  const group = await prisma.group.create({
    data: { userId: user.id, groupId, name },
    include: { members: true },
  });

  return NextResponse.json({ group });
}
