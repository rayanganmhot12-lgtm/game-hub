"use client";

import { useState } from "react";
import ModerationPanel from "@/components/ModerationPanel";
import AdminPanel from "@/components/AdminPanel";

interface ModerationActionLog {
  id: string;
  targetCode: string;
  targetDisplayName: string;
  action: string;
  reason: string | null;
  createdAt: string | Date;
}

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
}

type Tab = "actions" | "admin";

export default function ModerationTabs({
  myDisplayName,
  initialActions,
  friends,
  initialNameEffect,
  initialColor1,
  initialColor2,
}: {
  myDisplayName: string;
  initialActions: ModerationActionLog[];
  friends: Friend[];
  initialNameEffect: string | null;
  initialColor1: string | null;
  initialColor2: string | null;
}) {
  const [tab, setTab] = useState<Tab>("actions");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 border-b border-border">
        {(
          [
            ["actions", "Actions"],
            ["admin", "Admin"],
          ] as [Tab, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`rounded-t-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === value ? "border-b-2 border-accent-bright text-accent-bright" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "actions" ? (
        <ModerationPanel myDisplayName={myDisplayName} initialActions={initialActions} friends={friends} />
      ) : (
        <AdminPanel initialNameEffect={initialNameEffect} initialColor1={initialColor1} initialColor2={initialColor2} />
      )}
    </div>
  );
}
