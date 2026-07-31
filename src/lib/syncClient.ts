import { fireNativeNotification } from "@/lib/notify";

export interface NewAchievementDTO {
  gameTitle: string;
  achievementName: string;
}

export interface SyncResultDTO {
  accountId: string;
  platform: string;
  ok: boolean;
  gamesSynced?: number;
  newAchievements?: NewAchievementDTO[];
  pointsEarned?: number;
  error?: string;
}

export async function runSync(): Promise<SyncResultDTO[]> {
  const res = await fetch("/api/games/sync", { method: "POST" });
  const data = await res.json();
  return data.results ?? [];
}

export function notifyNewAchievements(
  newAchievements: NewAchievementDTO[],
  showToast: (message: string, variant?: "success" | "error" | "info") => void
) {
  for (const achievement of newAchievements.slice(0, 5)) {
    showToast(`Achievement unlocked: ${achievement.achievementName} — ${achievement.gameTitle}`, "success");
    fireNativeNotification(`Achievement unlocked: ${achievement.achievementName}`, achievement.gameTitle);
  }
}
