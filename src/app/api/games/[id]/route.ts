import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAchievements } from "@/lib/steam";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const ownedGame = await prisma.ownedGame.findUnique({
    where: { id },
    include: { game: true, account: true },
  });

  if (!ownedGame || ownedGame.account.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let achievements: Awaited<ReturnType<typeof fetchAchievements>> = [];
  if (ownedGame.account.platform === "STEAM") {
    try {
      achievements = await fetchAchievements(
        Number(ownedGame.game.platformGameId),
        ownedGame.account.platformAccountId
      );
    } catch {
      achievements = [];
    }
  }

  return NextResponse.json({
    id: ownedGame.id,
    title: ownedGame.game.title,
    platform: ownedGame.account.platform,
    coverImageUrl: ownedGame.game.coverImageUrl,
    headerImageUrl: ownedGame.game.headerImageUrl,
    description: ownedGame.game.description,
    playtimeMinutes: ownedGame.playtimeMinutes,
    playtimeMinutes2Wk: ownedGame.playtimeMinutes2Wk,
    lastPlayedAt: ownedGame.lastPlayedAt,
    installed: ownedGame.installed,
    rating: ownedGame.rating,
    notes: ownedGame.notes,
    backlog: ownedGame.backlog,
    tags: ownedGame.tags,
    accountDisplayName: ownedGame.account.displayName,
    achievements,
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const ownedGame = await prisma.ownedGame.findUnique({ where: { id }, include: { account: true } });
  if (!ownedGame || ownedGame.account.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json();
  const data: Prisma.OwnedGameUpdateInput = {};

  if (typeof body.installed === "boolean") {
    data.installed = body.installed;
  }
  if (body.rating === null) {
    data.rating = null;
  } else if (typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5) {
    data.rating = Math.round(body.rating);
  }
  if (typeof body.notes === "string") {
    data.notes = body.notes.slice(0, 2000);
  }
  if (typeof body.backlog === "boolean") {
    data.backlog = body.backlog;
  }
  if (typeof body.tags === "string") {
    const cleaned = body.tags
      .split(",")
      .map((t: string) => t.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 10);
    data.tags = cleaned.length > 0 ? cleaned.join(",") : null;
  }

  const updated = await prisma.ownedGame.update({ where: { id }, data });

  return NextResponse.json({
    id: updated.id,
    installed: updated.installed,
    rating: updated.rating,
    notes: updated.notes,
  });
}
