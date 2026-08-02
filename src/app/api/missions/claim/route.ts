import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMission } from "@/lib/missions";

// Pays out a completed mission, exactly once. The reward comes from the
// catalog rather than the request, and the "already claimed" check and the
// points increment happen in one transaction — a double-click or two tabs
// racing must not pay twice.
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
  const mission = typeof missionId === "string" ? getMission(missionId) : undefined;
  if (!mission) {
    return NextResponse.json({ error: "Unknown mission" }, { status: 400 });
  }

  try {
    const points = await prisma.$transaction(async (tx) => {
      // updateMany with claimedAt: null in the WHERE is the guard: a second
      // concurrent claim matches zero rows and throws below instead of
      // incrementing points again.
      const claimed = await tx.missionProgress.updateMany({
        where: { userId: user.id, missionId: mission.id, completedAt: { not: null }, claimedAt: null },
        data: { claimedAt: new Date() },
      });
      if (claimed.count === 0) {
        throw new Error("NOT_CLAIMABLE");
      }
      const updated = await tx.user.update({
        where: { id: user.id },
        data: {
          points: { increment: mission.reward },
          lifetimePointsEarned: { increment: mission.reward },
        },
        select: { points: true },
      });
      return updated.points;
    });

    return NextResponse.json({ ok: true, reward: mission.reward, points });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_CLAIMABLE") {
      return NextResponse.json({ error: "That mission isn't ready to claim." }, { status: 400 });
    }
    throw err;
  }
}
