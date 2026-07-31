"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useState, useCallback, useEffect } from "react";

export default function LibraryFilters({ availableTags = [] }: { availableTags?: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (q !== (searchParams.get("q") ?? "")) {
        updateParam("q", q);
      }
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search your library…"
          className="input-field w-full pl-9"
        />
      </div>

      <select
        defaultValue={searchParams.get("platform") ?? ""}
        onChange={(e) => updateParam("platform", e.target.value)}
        className="input-field"
      >
        <option value="">All Platforms</option>
        <option value="STEAM">Steam</option>
        <option value="EPIC">Epic</option>
      </select>

      <select
        defaultValue={searchParams.get("status") ?? ""}
        onChange={(e) => updateParam("status", e.target.value)}
        className="input-field"
      >
        <option value="">Any Status</option>
        <option value="installed">Installed Only</option>
        <option value="not-installed">Not Installed</option>
        <option value="backlog">Backlog</option>
        <option value="never-played">Never Played</option>
      </select>

      {availableTags.length > 0 && (
        <select
          defaultValue={searchParams.get("tag") ?? ""}
          onChange={(e) => updateParam("tag", e.target.value)}
          className="input-field"
        >
          <option value="">All Tags</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              #{tag}
            </option>
          ))}
        </select>
      )}

      <select
        defaultValue={searchParams.get("sort") ?? "playtime"}
        onChange={(e) => updateParam("sort", e.target.value)}
        className="input-field"
      >
        <option value="playtime">Sort: Most Played</option>
        <option value="title">Sort: Title A–Z</option>
        <option value="lastPlayed">Sort: Recently Played</option>
      </select>
    </div>
  );
}
