import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import PlaylistManager from "@/components/PlaylistManager";

export default async function PlaylistPage() {
  const user = await getCurrentUser();
  const isAdmin = isAdminEmail(user?.email);

  return <PlaylistManager isAdmin={isAdmin} />;
}
