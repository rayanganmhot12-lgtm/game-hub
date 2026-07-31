"use client";

import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { formatPlaytime } from "@/lib/format";

interface TrendEntry {
  weekLabel: string;
  minutes: number;
}

export default function PlaytimeTrendChart({ data }: { data: TrendEntry[] }) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted">
        Not enough history yet — come back after a couple more syncs (a week or two apart) to see your playtime
        trend build up.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="weekLabel" tick={{ fill: "#9a938a", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis hide />
        <Tooltip
          cursor={{ stroke: "var(--accent)", strokeWidth: 1, strokeOpacity: 0.3 }}
          contentStyle={{ background: "#131211", border: "1px solid #2a2724", borderRadius: 8 }}
          labelStyle={{ color: "#f2ede8" }}
          formatter={(value) => [formatPlaytime(Number(value)), "Played that week"]}
        />
        <Area
          type="monotone"
          dataKey="minutes"
          stroke="var(--accent-bright)"
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
