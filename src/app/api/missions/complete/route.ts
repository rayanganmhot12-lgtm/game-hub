import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMission } from "@/lib/missions";

// Marks a mission's goal as met. Deliberately does NOT pay out — claiming is
// a separate, explicit step, so the reward only lands when the user asks for
// it and the server can check "already claimed?" in one place.
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const missionId = (body as { missionId?: unknown })?.missionId;
  if (typeof missionId !== "string" || !getMission(missionId)) {
    return NextResponse.json({ error: "Unknown mission" }, { status: 400 });
  }

  const existing = await prisma.missionProgress.findUnique({
    where: { userId_missionId: { userId: user.id, missionId } },
  });

  // Already claimed means this one-time mission is finished for good —
  // re-completing it must not reopen the claim.
  if (existing?.claimedAt) {
    return NextResponse.json({ ok: true, alreadyClaimed: true });
  }
  if (existing?.completedAt) {
    return NextResponse.json({ ok: true, alreadyComplete: true });
  }

  await prisma.missionProgress.upsert({
    where: { userId_missionId: { userId: user.id, missionId } },
    create: { userId: user.id, missionId, completedAt: new Date() },
    update: { completedAt: new Date() },
  });

  return NextResponse.json({ ok: true, completed: true });
}
