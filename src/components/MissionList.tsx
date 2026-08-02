"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gem, Check, Gamepad2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { MISSIONS } from "@/lib/missions";

export interface MissionState {
  missionId: string;
  completed: boolean;
  claimed: boolean;
}

export default function MissionList({ states }: { states: MissionState[] }) {
  const { showToast } = useToast();
  const router = useRouter();
  const [claiming, setClaiming] = useState<string | null>(null);

  const stateFor = (id: string) => states.find((s) => s.missionId === id);

  async function handleClaim(missionId: string, reward: number) {
    setClaiming(missionId);
    try {
      const res = await fetch("/api/missions/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Couldn't claim that reward.", "error");
        return;
      }
      showToast(`+${reward} points!`, "success");
      router.refresh();
    } catch {
      showToast("Couldn't claim that reward.", "error");
    } finally {
      setClaiming(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {MISSIONS.map((mission) => {
        const state = stateFor(mission.id);
        const claimed = state?.claimed ?? false;
        const claimable = (state?.completed ?? false) && !claimed;

        return (
          <div
            key={mission.id}
            className={`panel flex flex-wrap items-center gap-4 p-4 transition-colors ${
              claimable ? "border-accent/60 bg-accent/5" : ""
            }`}
          >
            <div className={`icon-badge h-11 w-11 shrink-0 ${claimed ? "opacity-50" : ""}`}>
              <Gamepad2 size={22} />
            </div>

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${claimed ? "text-muted" : "text-foreground"}`}>{mission.title}</p>
              <p className="mt-0.5 text-xs text-muted">{mission.description}</p>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-accent-bright">
              <Gem size={14} />
              {mission.reward}
            </div>

            {claimed ? (
              <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-2 text-xs font-semibold text-muted">
                <Check size={14} />
                Claimed
              </span>
            ) : claimable ? (
              <button
                onClick={() => handleClaim(mission.id, mission.reward)}
                disabled={claiming === mission.id}
                className="btn-primary shrink-0 disabled:opacity-50"
              >
                {claiming === mission.id ? "Claiming…" : "Claim"}
              </button>
            ) : (
              <span className="shrink-0 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted">
                Not done yet
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
