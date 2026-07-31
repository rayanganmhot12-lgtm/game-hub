"use client";

import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { formatPlaytime } from "@/lib/format";

interface ActivityEntry {
  title: string;
  minutes: number;
}

export default function RecentActivityChart({ data }: { data: ActivityEntry[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-muted">No activity in the last 2 weeks.</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="title"
          width={110}
          tick={{ fill: "#9a938a", fontSize: 11 }}
          tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 15)}…` : value)}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          cursor={{ fill: "rgba(var(--accent-rgb), 0.08)" }}
          contentStyle={{ background: "#131211", border: "1px solid #2a2724", borderRadius: 8 }}
          labelStyle={{ color: "#f2ede8" }}
          formatter={(value) => [formatPlaytime(Number(value)), "Last 2 weeks"]}
        />
        <Bar dataKey="minutes" radius={[0, 4, 4, 0]} barSize={16}>
          {data.map((_, i) => (
            <Cell key={i} fill="var(--accent)" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
