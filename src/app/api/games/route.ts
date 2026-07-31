import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedGames } from "@/lib/games";
import type { Platform } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q")?.trim() || undefined;
  const platform = (searchParams.get("platform") as Platform | null) || undefined;
  const installedParam = searchParams.get("installed");
  const installed =
    installedParam === "true" ? true : installedParam === "false" ? false : undefined;
  const sort = (searchParams.get("sort") as "playtime" | "title" | "lastPlayed" | null) ?? "playtime";

  const games = await listOwnedGames(user.id, { q, platform, installed, sort });
  return NextResponse.json({ games });
}
