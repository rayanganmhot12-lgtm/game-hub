"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { isFirebaseConfigured } from "@/lib/firebase";
import { listenForGroupMessages, listenForGroupMuted } from "@/lib/groupRealtime";
import { logNotification } from "@/lib/notifications";

interface Server {
  groupId: string;
  name: string;
}

// Mounted once in the root app layout — watches every server the user is in
// for new messages and logs a notification, so you hear about activity in
// servers you aren't currently looking at (respecting each server's mute flag).
export default function GroupMessageNotifier({ servers, myCode }: { servers: Server[]; myCode: string }) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const [mountedAt] = useState(() => Date.now());

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!isFirebaseConfigured || servers.length === 0) return;

    const unsubs: Array<() => void> = [];
    for (const server of servers) {
      let muted = false;
      unsubs.push(listenForGroupMuted(server.groupId, myCode, (m) => { muted = m; }));
      unsubs.push(
        listenForGroupMessages(server.groupId, myCode, (message) => {
          // Firebase re-fires for the entire message backlog on every fresh
          // subscribe (this component mounts once per session) — ignore
          // anything that predates this mount so we don't replay history.
          if (message.sentAt <= mountedAt) return;
          if (pathnameRef.current === `/groups/${server.groupId}`) return;
          const mentioned = message.mentions?.includes(myCode);
          // A direct @mention is worth surfacing even in a muted server —
          // muting only suppresses the general chatter notification.
          if (mentioned) {
            logNotification("group_mention", `${message.senderDisplayName} mentioned you in ${server.name}: ${message.text.slice(0, 80)}`);
            return;
          }
          if (muted) return;
          logNotification("group_message", `${message.senderDisplayName} in ${server.name}: ${message.text.slice(0, 80)}`);
        })
      );
    }
    return () => unsubs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servers.map((s) => s.groupId).join(","), myCode]);

  return null;
}
