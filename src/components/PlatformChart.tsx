import { formatPlaytime } from "@/lib/format";

// Platform brand colours, kept as a small identifying dot per row rather than
// as large fills. Drawn as a donut they were the biggest block of colour on
// the dashboard and none of them belong to this app's palette, so the front
// page read as blue rather than as Game Hub.
const PLATFORM_COLORS: Record<string, string> = {
  STEAM: "#66c0f4",
  EPIC: "#a3a3ff",
  GOG: "#a855f7",
};

interface Breakdown {
  platform: string;
  games: number;
  playtimeMinutes: number;
}

// A donut is the wrong shape for this data: there are only ever a handful of
// platforms, and with one connected it drew a ring that was 100% a single
// colour — a lot of space to say nothing. Proportion bars show the same split
// while also giving the exact counts, and they stay readable as more
// platforms are added.
export default function PlatformChart({ data }: { data: Breakdown[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No data yet — connect a platform to see your breakdown.</p>;
  }

  const total = data.reduce((sum, entry) => sum + entry.games, 0);

  return (
    <div className="flex flex-col gap-3">
      {data.map((entry) => {
        const share = total > 0 ? (entry.games / total) * 100 : 0;
        return (
          <div key={entry.platform} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-medium text-foreground">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: PLATFORM_COLORS[entry.platform] ?? "var(--accent)" }}
                />
                {entry.platform}
              </span>
              <span className="text-xs tabular-nums text-muted">
                {entry.games} {entry.games === 1 ? "game" : "games"} · {formatPlaytime(entry.playtimeMinutes)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent-bright"
                style={{ width: `${share}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
