import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import MissionList, { type MissionState } from "@/components/MissionList";
import PageHeader from "@/components/PageHeader";

export default async function MissionsPage() {
  const user = await getCurrentUser();

  const progress = await prisma.missionProgress.findMany({
    where: { userId: user!.id },
    select: { missionId: true, completedAt: true, claimedAt: true },
  });

  const states: MissionState[] = progress.map((p) => ({
    missionId: p.missionId,
    completed: p.completedAt !== null,
    claimed: p.claimedAt !== null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader title="Missions" subtitle="Complete these to earn points you can spend in the Store." />
      </div>

      <MissionList states={states} />
    </div>
  );
}
