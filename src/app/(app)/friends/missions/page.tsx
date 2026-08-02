import { Sparkles } from "lucide-react";
import EmptyState from "@/components/EmptyState";

export default function MissionsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Missions</h1>
        <p className="text-sm text-muted">Complete quests to earn points.</p>
      </div>

      <EmptyState icon={Sparkles} title="Missions">
        Quests and rewards are coming soon.
      </EmptyState>
    </div>
  );
}
