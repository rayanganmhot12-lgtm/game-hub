"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Plus, Compass } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listenForGroupIcon } from "@/lib/groupRealtime";
import CreateServerModal from "@/components/CreateServerModal";

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
  friendBadge?: string | null;
}

interface Server {
  id: string;
  groupId: string;
  name: string;
}

function ServerIcon({ server, active }: { server: Server; active: boolean }) {
  const [icon, setIcon] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return listenForGroupIcon(server.groupId, setIcon);
  }, [server.groupId]);

  const initial = server.name.trim().charAt(0).toUpperCase() || "?";

  return (
    <Link
      href={`/groups/${server.groupId}`}
      title={server.name}
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full transition-all duration-200 hover:scale-110 ${
        active ? "rounded-2xl ring-2 ring-accent-bright" : "hover:rounded-2xl"
      }`}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI, not an optimizable remote/static asset
        <img src={icon} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-surface-2 text-sm font-semibold text-foreground">
          {initial}
        </span>
      )}
    </Link>
  );
}

export default function ServerRail({
  servers,
  myCode,
  myDisplayName,
  myBadge,
  friends,
}: {
  servers: Server[];
  myCode: string;
  myDisplayName: string;
  myBadge?: string | null;
  friends: Friend[];
}) {
  const pathname = usePathname();
  const [showModal, setShowModal] = useState(false);
  const onFriends = pathname.startsWith("/friends");

  return (
    <>
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-border/60 bg-surface/60 pb-3 pt-24 backdrop-blur-xl md:flex">
        <Link
          href="/friends"
          title="Friends"
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
            onFriends ? "rounded-2xl bg-accent text-black" : "bg-surface-2 text-foreground hover:rounded-2xl hover:bg-accent/20"
          }`}
        >
          <Users size={20} />
        </Link>

        {servers.length > 0 && <div className="h-px w-8 shrink-0 bg-border" />}

        {servers.map((s) => (
          <ServerIcon key={s.id} server={s} active={pathname === `/groups/${s.groupId}`} />
        ))}

        <button
          onClick={() => setShowModal(true)}
          title="Add a Server"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-emerald-400 transition-all duration-200 hover:scale-110 hover:rounded-2xl hover:bg-emerald-400/20"
        >
          <Plus size={20} />
        </button>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted opacity-40" title="Discover — coming soon">
          <Compass size={18} />
        </span>
      </aside>

      {showModal && (
        <CreateServerModal
          myCode={myCode}
          myDisplayName={myDisplayName}
          myBadge={myBadge}
          friends={friends}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
