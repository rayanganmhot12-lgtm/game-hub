import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedGames } from "@/lib/games";
import BigPictureView from "@/components/BigPictureView";

// Deliberately outside the (app) layout group — no navbar/sidebar/music bar
// chrome at all, just the couch/controller-friendly grid full-screen.
export default async function BigPicturePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/");
  }

  const games = await listOwnedGames(user.id, { sort: "playtime" });

  return <BigPictureView games={games} />;
}
