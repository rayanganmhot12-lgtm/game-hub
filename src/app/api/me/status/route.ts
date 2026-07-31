import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { fetchOwnGameStatus } from "@/lib/steam";

// Powers the Electron tray/Discord Rich Presence integration — what the
// user is playing on Steam right now, not just cumulative synced playtime.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const steamAccount = user.accounts.find((a) => a.platform === "STEAM");
  if (!steamAccount) {
    return NextResponse.json({ playing: null });
  }

  try {
    const playing = await fetchOwnGameStatus(steamAccount.platformAccountId);
    return NextResponse.json({ playing });
  } catch {
    return NextResponse.json({ playing: null });
  }
}
