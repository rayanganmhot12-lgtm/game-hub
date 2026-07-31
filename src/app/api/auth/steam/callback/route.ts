import { NextRequest, NextResponse } from "next/server";
import { verifySteamCallback, fetchPlayerSummary } from "@/lib/steam";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { syncSteamLibrary } from "@/lib/gameSync";

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const steamId = await verifySteamCallback(request.nextUrl.searchParams);

  if (!steamId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=steam_auth_failed`);
  }

  const session = await getSession();
  if (!session.userId) {
    return NextResponse.redirect(`${baseUrl}/?error=must_sign_in`);
  }

  const existingAccount = await prisma.account.findUnique({
    where: { platform_platformAccountId: { platform: "STEAM", platformAccountId: steamId } },
  });
  if (existingAccount && existingAccount.userId !== session.userId) {
    return NextResponse.redirect(`${baseUrl}/connect?error=steam_already_linked`);
  }

  let summary = null;
  try {
    summary = await fetchPlayerSummary(steamId);
  } catch (err) {
    console.error("Steam GetPlayerSummaries failed:", err);
  }

  const account = await prisma.account.upsert({
    where: { platform_platformAccountId: { platform: "STEAM", platformAccountId: steamId } },
    update: {
      displayName: summary?.personaname ?? steamId,
      avatarUrl: summary?.avatarfull,
      profileUrl: summary?.profileurl,
    },
    create: {
      userId: session.userId,
      platform: "STEAM",
      platformAccountId: steamId,
      displayName: summary?.personaname ?? steamId,
      avatarUrl: summary?.avatarfull,
      profileUrl: summary?.profileurl,
    },
  });

  try {
    await syncSteamLibrary(account.id, steamId);
  } catch (err) {
    console.error("Steam library sync failed:", err);
  }

  return NextResponse.redirect(`${baseUrl}/connect?connected=steam`);
}
