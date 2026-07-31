const STORE_API_BASE = "https://store.steampowered.com/api";

export interface SteamScreenshot {
  id: number;
  thumbnail: string;
  full: string;
}

// Steam's public store API (no key required) — separate from the
// authenticated Web API used elsewhere in this app. Best-effort: apps with
// no store page, or a network hiccup, just return an empty gallery.
export async function fetchScreenshots(appid: number): Promise<SteamScreenshot[]> {
  try {
    const res = await fetch(`${STORE_API_BASE}/appdetails?appids=${appid}&filters=screenshots`);
    if (!res.ok) return [];

    const data = await res.json();
    const entry = data?.[String(appid)];
    if (!entry?.success) return [];

    const screenshots: Array<{ id: number; path_thumbnail: string; path_full: string }> =
      entry.data?.screenshots ?? [];

    return screenshots.map((s) => ({ id: s.id, thumbnail: s.path_thumbnail, full: s.path_full }));
  } catch {
    return [];
  }
}
