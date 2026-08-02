import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import ModerationSidebar from "@/components/ModerationSidebar";

export default async function ModerationLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <ModerationSidebar />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Moderation</h1>
          <p className="text-sm text-muted">Warn, mute, timeout, or ban a user by their friend code.</p>
        </div>
        {children}
      </div>
    </div>
  );
}
