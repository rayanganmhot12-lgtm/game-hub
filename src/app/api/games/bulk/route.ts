import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const ids: unknown = body.ids;
  if (!Array.isArray(ids) || ids.length === 0 || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }
  if (typeof body.installed !== "boolean") {
    return NextResponse.json({ error: "installed must be a boolean" }, { status: 400 });
  }

  // Scoped to the current user's own accounts — ids for games owned by
  // someone else are silently excluded rather than trusted from the client.
  const result = await prisma.ownedGame.updateMany({
    where: { id: { in: ids }, account: { userId: user.id } },
    data: { installed: body.installed },
  });

  return NextResponse.json({ ok: true, updated: result.count });
}
