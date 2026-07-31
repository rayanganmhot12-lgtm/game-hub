import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Upserts a member into this installation's local copy of the group —
// called repeatedly as the group's Firebase roster changes, so every
// member's local member list stays in sync with who's actually in it.
export async function POST(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { groupId } = await context.params;

  const body = await request.json();
  const memberCode = typeof body.memberCode === "string" ? body.memberCode : "";
  const memberDisplayName = typeof body.memberDisplayName === "string" ? body.memberDisplayName.slice(0, 60) : "";
  const memberBadge = typeof body.memberBadge === "string" ? body.memberBadge.slice(0, 60) : null;
  if (!memberCode || !memberDisplayName) {
    return NextResponse.json({ error: "memberCode and memberDisplayName are required" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { userId_groupId: { userId: user.id, groupId } } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  const member = await prisma.groupMember.upsert({
    where: { groupId_memberCode: { groupId: group.id, memberCode } },
    update: { memberDisplayName, memberBadge },
    create: { groupId: group.id, memberCode, memberDisplayName, memberBadge },
  });

  return NextResponse.json({ member });
}

// Removes a member from this installation's local copy (someone left the
// group's Firebase roster).
export async function DELETE(request: NextRequest, context: { params: Promise<{ groupId: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { groupId } = await context.params;
  const memberCode = request.nextUrl.searchParams.get("memberCode") ?? "";
  if (!memberCode) {
    return NextResponse.json({ error: "memberCode is required" }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { userId_groupId: { userId: user.id, groupId } } });
  if (!group) {
    return NextResponse.json({ error: "Group not found" }, { status: 404 });
  }

  await prisma.groupMember.deleteMany({ where: { groupId: group.id, memberCode } });

  return NextResponse.json({ ok: true });
}
