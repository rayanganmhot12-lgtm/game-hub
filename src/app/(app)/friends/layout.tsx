import FriendsSidebar from "@/components/FriendsSidebar";

export default function FriendsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:gap-6">
      <FriendsSidebar />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
