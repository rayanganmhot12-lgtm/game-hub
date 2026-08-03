import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// This layout used to exist to render the second navigation column, because
// falling back to the app's own meant landing on a list that had no Playlist
// entry — nothing highlighted, and the row you had just clicked gone. The one
// column now lists Playlist, so there is nothing left to compensate for.
export default async function PlaylistLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Layouts render in parallel with pages, so this can't lean on the app
  // layout's own redirect having run first.
  if (!user) {
    redirect("/");
  }

  return <>{children}</>;
}
