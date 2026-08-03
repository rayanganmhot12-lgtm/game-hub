import fs from "fs";
import path from "path";

export interface InstallSettings {
  steamApiKey?: string;
  // Account that gets the developer panels on this machine. Nothing in the
  // app writes it — electron/main.js reads it and passes it to the server
  // process as ADMIN_EMAIL — but it has to be listed here so the read/write
  // merge below preserves it instead of dropping it on the next save.
  adminEmail?: string;
  // Store price overrides the developer account set, keyed by cosmetic id.
  // Mirrored here from the Firebase relay so the purchase route can read
  // them synchronously and stay the authority on what an item costs.
  storePrices?: Record<string, number>;
}

// Where per-install (not per-account) config lives — the same directory
// secrets.json (SESSION_SECRET) already uses. In a packaged Electron build
// this is GAMEHUB_DATA_DIR (the app's userData directory, passed to the
// server process by electron/main.js), which survives every update since
// NSIS only wipes the install directory, never userData. In local dev
// (no Electron, GAMEHUB_DATA_DIR unset) it falls back to the project root.
function settingsPath(): string {
  const dir = process.env.GAMEHUB_DATA_DIR ?? process.cwd();
  return path.join(dir, "settings.json");
}

// Never throws — a missing or malformed settings file just means "nothing
// saved yet", not an error. Callers decide what a missing value means.
export function readInstallSettings(): InstallSettings {
  try {
    const raw = fs.readFileSync(settingsPath(), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const fields = parsed as Record<string, unknown>;

    // Every known field has to be read back here, not just the one a given
    // caller wants: writeInstallSettings merges over whatever this returns,
    // so a field dropped on read would be erased on the next write.
    const settings: InstallSettings = {};
    if (typeof fields.steamApiKey === "string") settings.steamApiKey = fields.steamApiKey;
    if (typeof fields.adminEmail === "string") settings.adminEmail = fields.adminEmail;
    if (typeof fields.storePrices === "object" && fields.storePrices !== null) {
      const prices: Record<string, number> = {};
      for (const [itemId, cost] of Object.entries(fields.storePrices as Record<string, unknown>)) {
        if (typeof cost === "number" && Number.isInteger(cost) && cost >= 0) prices[itemId] = cost;
      }
      if (Object.keys(prices).length > 0) settings.storePrices = prices;
    }
    return settings;
  } catch {
    return {};
  }
}

// Merges with whatever else is already saved, so setting one field never
// wipes another — same pattern this app already uses for group rosters.
export function writeInstallSettings(partial: Partial<InstallSettings>): void {
  const current = readInstallSettings();
  const next = { ...current, ...partial };
  fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2));
}
