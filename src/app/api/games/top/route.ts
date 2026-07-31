import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedGames } from "@/lib/games";

// Powers the Electron tray's "Quick Launch" submenu — top Steam games by
// playtime that can be launched via steam://run/<appid> without opening
// the main window.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const games = await listOwnedGames(user.id, { sort: "playtime" });
  const top = games
    .filter((g) => g.platform === "STEAM" && g.platformGameId)
    .slice(0, 5)
    .map((g) => ({ id: g.id, title: g.title, platformGameId: g.platformGameId }));

  return NextResponse.json({ games: top });
}
