import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Only the admin account can reorder tracks." }, { status: 403 });
  }

  const body = await request.json();
  const orderedIds: unknown = body.orderedIds;
  if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "orderedIds must be an array of track IDs." }, { status: 400 });
  }

  const base = Date.now();
  await Promise.all(
    orderedIds.map((id, index) =>
      prisma.track.update({
        where: { id },
        data: { uploadedAt: new Date(base + index) },
      })
    )
  );

  return NextResponse.json({ ok: true });
}
