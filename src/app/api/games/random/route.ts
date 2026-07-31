import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedGames } from "@/lib/games";
import { formatRelativeDate } from "@/lib/format";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const games = await listOwnedGames(user.id);
  if (games.length === 0) {
    return NextResponse.json({ game: null });
  }

  const now = Date.now();
  const weighted = games.map((game) => {
    let weight = 3;
    if (game.lastPlayedAt) {
      const daysSince = (now - new Date(game.lastPlayedAt).getTime()) / (1000 * 60 * 60 * 24);
      weight = Math.max(0.2, Math.min(3, 0.5 + daysSince / 30));
    }
    return { game, weight };
  });

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  let picked = weighted[0].game;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) {
      picked = w.game;
      break;
    }
  }

  const reason = picked.lastPlayedAt
    ? `Last played ${formatRelativeDate(picked.lastPlayedAt)}`
    : "You've never played this one — give it a shot!";

  return NextResponse.json({ game: picked, reason });
}
