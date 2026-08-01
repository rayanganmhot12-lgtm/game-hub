import fs from "fs";
import path from "path";

export interface InstallSettings {
  steamApiKey?: string;
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
    return JSON.parse(raw) as InstallSettings;
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
