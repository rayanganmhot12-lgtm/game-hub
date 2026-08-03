import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Trophy, Images } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchAchievements } from "@/lib/steam";
import { fetchScreenshots } from "@/lib/steamStore";
import PlatformBadge from "@/components/PlatformBadge";
import InstalledToggle from "@/components/InstalledToggle";
import { PlayButton } from "@/components/PlayButton";
import RatingNotes from "@/components/RatingNotes";
import TagsAndBacklog from "@/components/TagsAndBacklog";
import ScreenshotGallery from "@/components/ScreenshotGallery";
import { formatPlaytime, formatRelativeDate } from "@/lib/format";

export default async function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  const ownedGame = await prisma.ownedGame.findUnique({
    where: { id },
    include: { game: true, account: true },
  });

  if (!ownedGame || ownedGame.account.userId !== user!.id) {
    notFound();
  }

  let achievements: Awaited<ReturnType<typeof fetchAchievements>> = [];
  if (ownedGame.account.platform === "STEAM") {
    try {
      achievements = await fetchAchievements(
        Number(ownedGame.game.platformGameId),
        ownedGame.account.platformAccountId
      );
    } catch {
      achievements = [];
    }
  }
  const unlockedCount = achievements.filter((a) => a.achieved).length;

  const screenshots =
    ownedGame.account.platform === "STEAM" ? await fetchScreenshots(Number(ownedGame.game.platformGameId)) : [];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/library" className="flex w-fit items-center gap-2 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={16} />
        Back to Library
      </Link>

      <div className="panel overflow-hidden">
        <div className="relative h-48 w-full bg-surface-2 sm:h-64">
          {ownedGame.game.headerImageUrl && (
            <Image
              src={ownedGame.game.headerImageUrl}
              alt={ownedGame.game.title}
              fill
              unoptimized
              className="object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/40 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <PlatformBadge platform={ownedGame.account.platform} />
          </div>
        </div>

        <div className="flex flex-col gap-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-bold text-foreground">{ownedGame.game.title}</h1>
            <div className="flex items-center gap-2">
              <PlayButton platform={ownedGame.account.platform} platformGameId={ownedGame.game.platformGameId} />
              <InstalledToggle
                id={ownedGame.id}
                initialInstalled={ownedGame.installed}
                platform={ownedGame.account.platform}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <InfoStat icon={Clock} label="Total Playtime" value={formatPlaytime(ownedGame.playtimeMinutes)} />
            <InfoStat
              icon={Clock}
              label="Last 2 Weeks"
              value={ownedGame.playtimeMinutes2Wk ? formatPlaytime(ownedGame.playtimeMinutes2Wk) : "—"}
            />
            <InfoStat icon={Calendar} label="Last Played" value={formatRelativeDate(ownedGame.lastPlayedAt)} />
          </div>

          {ownedGame.game.description && (
            <p className="text-sm leading-relaxed text-muted">{ownedGame.game.description}</p>
          )}
        </div>
      </div>

      {screenshots.length > 0 && (
        <div className="panel p-5">
          <h2 className="section-title mb-3">
            <Images size={16} className="text-accent-bright" />
            Screenshots
          </h2>
          <ScreenshotGallery screenshots={screenshots} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <RatingNotes id={ownedGame.id} initialRating={ownedGame.rating} initialNotes={ownedGame.notes} />
        <TagsAndBacklog
          id={ownedGame.id}
          initialTags={ownedGame.tags ? ownedGame.tags.split(",") : []}
          initialBacklog={ownedGame.backlog}
        />
      </div>

      {ownedGame.account.platform === "STEAM" && (
        <div className="panel p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">
              <Trophy size={16} className="text-accent-bright" />
              Achievements
            </h2>
            {achievements.length > 0 && (
              <span className="text-xs text-muted">
                {unlockedCount} / {achievements.length} unlocked
              </span>
            )}
          </div>

          {achievements.length === 0 ? (
            <p className="text-sm text-muted">No achievement data available for this game.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {achievements.map((a) => (
                <div
                  key={a.apiName}
                  className={`flex items-center gap-3 rounded-md border p-2 ${
                    a.achieved ? "border-accent-dim bg-accent/5" : "border-border opacity-50"
                  }`}
                >
                  {(a.achieved ? a.icon : a.iconGray) && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.achieved ? a.icon : a.iconGray}
                      alt=""
                      width={32}
                      height={32}
                      className="rounded"
                    />
                  )}
                  <span className="text-xs text-foreground">{a.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoStat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
      <Icon size={16} className="text-accent-bright" />
      <div>
        <p className="text-[11px] text-muted">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}
