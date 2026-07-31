"use client";

import { useEffect } from "react";
import { startPresenceHeartbeat } from "@/lib/presence";

export default function PresenceHeartbeat({ myCode }: { myCode: string }) {
  useEffect(() => {
    return startPresenceHeartbeat(myCode);
  }, [myCode]);

  return null;
}
