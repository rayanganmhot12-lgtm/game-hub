import { getCurrentUser } from "@/lib/auth";
import AdminPanel from "@/components/AdminPanel";

export default async function ModerationAdminPage() {
  const user = await getCurrentUser();

  return (
    <AdminPanel
      initialNameEffect={user!.nameEffect}
      initialColor1={user!.nameEffectColor1}
      initialColor2={user!.nameEffectColor2}
    />
  );
}
