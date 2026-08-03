import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import ModerationSidebar from "@/components/ModerationSidebar";
import PageHeader from "@/components/PageHeader";

export default async function ModerationLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    redirect("/dashboard");
  }
  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      {/* Section navigation only. The profile card that used to sit under it
          was a second copy of the one the app column already carries. */}
      <div className="flex shrink-0 flex-col md:w-52">
        <ModerationSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <PageHeader title="Moderation" subtitle="Warn, mute, timeout, or ban a user by their friend code." />
        {children}
      </div>
    </div>
  );
}
