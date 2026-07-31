"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { formatPlaytime } from "@/lib/format";

const COLORS: Record<string, string> = {
  STEAM: "#66c0f4",
  EPIC: "#a3a3ff",
  GOG: "#a855f7",
};

interface Breakdown {
  platform: string;
  games: number;
  playtimeMinutes: number;
}

export default function PlatformChart({ data }: { data: Breakdown[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No data yet — connect a platform to see your breakdown.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="games"
          nameKey="platform"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={3}
        >
          {data.map((entry) => (
            <Cell key={entry.platform} fill={COLORS[entry.platform] ?? "#ff6b00"} stroke="none" />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: "#131211", border: "1px solid #2a2724", borderRadius: 8 }}
          labelStyle={{ color: "#f2ede8" }}
          formatter={(value, _name, entry) => {
            const payload = entry.payload as unknown as Breakdown;
            return [`${value} games · ${formatPlaytime(payload.playtimeMinutes)}`, payload.platform];
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#9a938a" }} />
      </PieChart>
    </ResponsiveContainer>
  );
}
