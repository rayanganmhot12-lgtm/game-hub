import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { syncSteamLibrary } from "@/lib/gameSync";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const results = [];
  for (const account of user.accounts) {
    if (account.platform === "STEAM") {
      try {
        const { count, newAchievements, pointsEarned } = await syncSteamLibrary(
          account.id,
          account.platformAccountId
        );
        results.push({
          accountId: account.id,
          platform: account.platform,
          ok: true,
          gamesSynced: count,
          newAchievements,
          pointsEarned,
        });
      } catch (err) {
        console.error("Steam library sync failed:", err);
        results.push({
          accountId: account.id,
          platform: account.platform,
          ok: false,
          error: "Couldn't reach Steam. Add your Steam API key on the Connections page, or check your existing key.",
        });
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}
