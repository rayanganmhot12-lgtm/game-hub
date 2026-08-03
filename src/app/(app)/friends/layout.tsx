import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// No column of its own any more. This area used to render FriendsSidebar, a
// second navigation list that replaced the app's own — so opening Friends made
// six destinations disappear, and a page existed whose only job was linking
// back to four of them. There is one column now, in the app layout.
export default async function FriendsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // Layouts render in parallel with pages, so this can't lean on the app
  // layout's own redirect having run first.
  if (!user) {
    redirect("/");
  }

  return <>{children}</>;
}
