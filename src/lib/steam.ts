import { readInstallSettings } from "@/lib/installSettings";

const STEAM_OPENID_ENDPOINT = "https://steamcommunity.com/openid/login";
const STEAM_API_BASE = "https://api.steampowered.com";

// The env var always wins (unchanged local-dev workflow: .env or a
// PowerShell-set environment variable). Falling back to the persisted
// settings file is what lets a packaged install work without either.
function getSteamApiKey(): string {
  if (process.env.STEAM_API_KEY) return process.env.STEAM_API_KEY;
  const settings = readInstallSettings();
  if (settings.steamApiKey) return settings.steamApiKey;
  throw new Error("STEAM_API_KEY is not configured");
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

export function getSteamLoginUrl() {
  const baseUrl = getBaseUrl();
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${baseUrl}/api/auth/steam/callback`,
    "openid.realm": baseUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`;
}

/**
 * Steam's OpenID callback must be re-verified directly with Steam
 * (mode=check_authentication) since the params can't be trusted as-is.
 * Returns the verified 64-bit SteamID, or null if verification fails.
 */
export async function verifySteamCallback(
  query: URLSearchParams
): Promise<string | null> {
  const claimedId = query.get("openid.claimed_id");
  if (!claimedId) return null;

  const verifyParams = new URLSearchParams(query);
  verifyParams.set("openid.mode", "check_authentication");

  const res = await fetch(STEAM_OPENID_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyParams.toString(),
  });
  const text = await res.text();
  if (!/is_valid\s*:\s*true/.test(text)) return null;

  const match = claimedId.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/);
  return match ? match[1] : null;
}

export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  playtime_2weeks?: number;
  rtime_last_played?: number;
  img_icon_url?: string;
}

export async function fetchOwnedGames(steamId: string): Promise<SteamOwnedGame[]> {
  const apiKey = getSteamApiKey();

  const params = new URLSearchParams({
    key: apiKey,
    steamid: steamId,
    format: "json",
    include_appinfo: "true",
    include_played_free_games: "true",
  });
  const res = await fetch(
    `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v0001/?${params.toString()}`
  );
  if (!res.ok) throw new Error(`Steam GetOwnedGames failed: ${res.status}`);
  const data = await res.json();
  return data?.response?.games ?? [];
}

export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatarfull: string;
}

export async function fetchPlayerSummary(
  steamId: string
): Promise<SteamPlayerSummary | null> {
  const apiKey = getSteamApiKey();

  const params = new URLSearchParams({ key: apiKey, steamids: steamId });
  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v0002/?${params.toString()}`
  );
  if (!res.ok) throw new Error(`Steam GetPlayerSummaries failed: ${res.status}`);
  const data = await res.json();
  return data?.response?.players?.[0] ?? null;
}

export interface SteamAchievement {
  apiName: string;
  name: string;
  description?: string;
  icon?: string;
  iconGray?: string;
  achieved: boolean;
  unlockTime?: number;
}

/**
 * Best-effort achievement fetch. Many games have no stats/achievements at all,
 * or the profile's game details are private — callers should treat a thrown
 * error or empty array as "no achievement data available" rather than a hard failure.
 */
export async function fetchAchievements(
  appid: number,
  steamId: string
): Promise<SteamAchievement[]> {
  const apiKey = getSteamApiKey();

  const [playerRes, schemaRes] = await Promise.all([
    fetch(
      `${STEAM_API_BASE}/ISteamUserStats/GetPlayerAchievements/v0001/?${new URLSearchParams(
        { appid: String(appid), key: apiKey, steamid: steamId }
      ).toString()}`
    ),
    fetch(
      `${STEAM_API_BASE}/ISteamUserStats/GetSchemaForGame/v2/?${new URLSearchParams({
        appid: String(appid),
        key: apiKey,
      }).toString()}`
    ),
  ]);

  if (!playerRes.ok || !schemaRes.ok) return [];

  const playerData = await playerRes.json();
  const schemaData = await schemaRes.json();

  const playerAchievements: Array<{ apiname: string; achieved: number; unlocktime: number }> =
    playerData?.playerstats?.achievements ?? [];
  if (!playerData?.playerstats?.success || playerAchievements.length === 0) return [];

  const schemaAchievements: Array<{
    name: string;
    displayName: string;
    description?: string;
    icon?: string;
    icongray?: string;
  }> = schemaData?.game?.availableGameStats?.achievements ?? [];
  const schemaByName = new Map(schemaAchievements.map((a) => [a.name, a]));

  return playerAchievements.map((a) => {
    const schema = schemaByName.get(a.apiname);
    return {
      apiName: a.apiname,
      name: schema?.displayName ?? a.apiname,
      description: schema?.description,
      icon: schema?.icon,
      iconGray: schema?.icongray,
      achieved: a.achieved === 1,
      unlockTime: a.unlocktime || undefined,
    };
  });
}

export function steamCoverImageUrl(appid: number) {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`;
}

export function steamHeaderImageUrl(appid: number) {
  return `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`;
}

export interface FriendActivity {
  steamId: string;
  personaName: string;
  avatarUrl: string;
  personaState: number;
  gameExtraInfo?: string;
}

/**
 * Requires the account's friends list to be set to Public in Steam privacy
 * settings — Steam returns an empty list rather than an error otherwise, so
 * callers should treat an empty result as "nothing to show" not a failure.
 */
export async function fetchFriendsActivity(steamId: string): Promise<FriendActivity[]> {
  const apiKey = getSteamApiKey();

  const friendListRes = await fetch(
    `${STEAM_API_BASE}/ISteamUser/GetFriendList/v1/?${new URLSearchParams({
      key: apiKey,
      steamid: steamId,
      relationship: "friend",
    }).toString()}`
  );
  if (!friendListRes.ok) return [];

  const friendListData = await friendListRes.json();
  const friendIds: string[] = (friendListData?.friendslist?.friends ?? []).map(
    (f: { steamid: string }) => f.steamid
  );
  if (friendIds.length === 0) return [];

  // GetPlayerSummaries accepts up to 100 steamids per call.
  const summariesRes = await fetch(
    `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?${new URLSearchParams({
      key: apiKey,
      steamids: friendIds.slice(0, 100).join(","),
    }).toString()}`
  );
  if (!summariesRes.ok) return [];

  const summariesData = await summariesRes.json();
  const players: Array<{
    steamid: string;
    personaname: string;
    avatarfull: string;
    personastate: number;
    gameextrainfo?: string;
  }> = summariesData?.response?.players ?? [];

  return players
    .filter((p) => p.personastate !== 0)
    .map((p) => ({
      steamId: p.steamid,
      personaName: p.personaname,
      avatarUrl: p.avatarfull,
      personaState: p.personastate,
      gameExtraInfo: p.gameextrainfo,
    }))
    .sort((a, b) => (b.gameExtraInfo ? 1 : 0) - (a.gameExtraInfo ? 1 : 0));
}

// Powers Discord Rich Presence — checks whether the user is currently
// in-game on Steam right now (not just cumulative playtime from sync).
export async function fetchOwnGameStatus(steamId: string): Promise<string | null> {
  const apiKey = getSteamApiKey();

  const res = await fetch(
    `${STEAM_API_BASE}/ISteamUser/GetPlayerSummaries/v2/?${new URLSearchParams({
      key: apiKey,
      steamids: steamId,
    }).toString()}`
  );
  if (!res.ok) return null;

  const data = await res.json();
  const player: { gameextrainfo?: string } | undefined = data?.response?.players?.[0];
  return player?.gameextrainfo ?? null;
}
