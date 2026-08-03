import { SearchX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { listOwnedGames, listUserTags } from "@/lib/games";
import LibraryGameGrid from "@/components/LibraryGameGrid";
import LibraryFilters from "@/components/LibraryFilters";
import SavedViews from "@/components/SavedViews";
import EmptyState from "@/components/EmptyState";
import type { Platform } from "@/generated/prisma/client";
import PageHeader from "@/components/PageHeader";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; platform?: string; status?: string; tag?: string; sort?: string }>;
}) {
  const user = await getCurrentUser();
  const params = await searchParams;

  const [games, availableTags] = await Promise.all([
    listOwnedGames(user!.id, {
      q: params.q,
      platform: (params.platform as Platform) || undefined,
      installed: params.status === "installed" ? true : params.status === "not-installed" ? false : undefined,
      backlog: params.status === "backlog" ? true : undefined,
      neverPlayed: params.status === "never-played",
      tag: params.tag || undefined,
      sort: (params.sort as "playtime" | "title" | "lastPlayed") || "playtime",
    }),
    listUserTags(user!.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Library" subtitle={`${games.length} games across all connected platforms.`} />

      <LibraryFilters availableTags={availableTags} />
      <SavedViews />

      {games.length === 0 ? (
        <EmptyState icon={SearchX} title="No games match your filters">
          Try clearing a filter or searching for something else.
        </EmptyState>
      ) : (
        <LibraryGameGrid
          games={games}
          className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6"
        />
      )}
    </div>
  );
}
