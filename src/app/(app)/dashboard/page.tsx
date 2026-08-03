import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { computeStats, computePlaytimeTrend } from "@/lib/stats";
import { fetchFriendsActivity, type FriendActivity } from "@/lib/steam";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import AnimatedGameGrid from "@/components/AnimatedGameGrid";
import PlatformChart from "@/components/PlatformChart";
import { Library, Clock, Layers, Gamepad2, Users, TrendingUp } from "lucide-react";
import { formatPlaytime } from "@/lib/format";
import EmptyState from "@/components/EmptyState";
import RandomGamePicker from "@/components/RandomGamePicker";
import RecentActivityChart from "@/components/RecentActivityChart";
import PlaytimeTrendChart from "@/components/PlaytimeTrendChart";
import FriendsActivity from "@/components/FriendsActivity";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const stats = await computeStats(user!.id);
  const playtimeTrend = await computePlaytimeTrend(user!.id);

  const steamAccount = user!.accounts.find((a) => a.platform === "STEAM");
  let friends: FriendActivity[] = [];
  if (steamAccount) {
    try {
      friends = await fetchFriendsActivity(steamAccount.platformAccountId);
    } catch {
      friends = [];
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-fade-up">
        <PageHeader title="Dashboard" subtitle="An overview of your entire game collection." />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="animate-fade-up" style={{ animationDelay: "60ms" }}>
          <StatCard label="Total Games" value={String(stats.totalGames)} icon={Library} />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
          <StatCard label="Total Playtime" value={formatPlaytime(stats.totalPlaytimeMinutes)} icon={Clock} />
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "180ms" }}>
          <StatCard label="Platforms Connected" value={String(stats.platformBreakdown.length)} icon={Layers} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="animate-fade-up flex flex-col gap-4 lg:col-span-1" style={{ animationDelay: "220ms" }}>
          <div className="panel p-5">
            <h2 className="section-title mb-3">
              <Layers size={13} />
              Platform Breakdown
            </h2>
            <PlatformChart data={stats.platformBreakdown} />
          </div>
          <RandomGamePicker />
          {steamAccount && (
            <div className="panel p-5">
              <h2 className="section-title mb-3">
                <Users size={13} />
                Friends Playing Now
              </h2>
              <FriendsActivity friends={friends} />
            </div>
          )}
        </div>

        <div className="panel animate-fade-up p-5 lg:col-span-2" style={{ animationDelay: "260ms" }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">
              <Gamepad2 size={13} />
              Recently Played
            </h2>
            <Link href="/library" className="text-xs font-medium text-accent-bright hover:underline">
              View full library →
            </Link>
          </div>
          {stats.recentlyPlayed.length === 0 ? (
            <EmptyState icon={Gamepad2} title="Nothing played yet">
              <Link href="/library" className="text-accent-bright hover:underline">
                Browse your library
              </Link>
            </EmptyState>
          ) : (
            // Six columns inside a two-thirds-width panel left each card too
            // narrow for its own title — every one ellipsed mid-word. Four
            // gives them room to read.
            <AnimatedGameGrid
              className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
              games={stats.recentlyPlayed.map((g) => ({
                id: g.id,
                title: g.title,
                platform: g.platform,
                platformGameId: g.platformGameId,
                coverImageUrl: g.coverImageUrl,
                playtimeMinutes: g.playtimeMinutes,
                installed: false,
              }))}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel animate-fade-up p-5" style={{ animationDelay: "300ms" }}>
          <h2 className="section-title mb-3">
            <Clock size={13} />
            Last 2 Weeks
          </h2>
          <RecentActivityChart data={stats.recentActivity} />
        </div>

        <div className="panel animate-fade-up p-5" style={{ animationDelay: "340ms" }}>
          <h2 className="section-title mb-3">
            <TrendingUp size={13} />
            Playtime Trend
          </h2>
          <PlaytimeTrendChart data={playtimeTrend} />
        </div>
      </div>
    </div>
  );
}
