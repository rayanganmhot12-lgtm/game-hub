// The mission catalog. Rewards live here rather than in the database so a
// mission can be re-priced without touching anyone's saved progress — same
// idea as the cosmetics catalog.
export interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  // One-time missions stay completed forever once claimed. Everything here
  // is one-time today; repeatable missions would need a reset rule, so the
  // flag is explicit rather than assumed.
  repeat: "once";
}

export const MISSION_PLAY_GAME = "play-a-game";

export const MISSIONS: Mission[] = [
  {
    id: MISSION_PLAY_GAME,
    title: "Launch a game",
    description: "Start any game from your library.",
    reward: 50,
    repeat: "once",
  },
];

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}
