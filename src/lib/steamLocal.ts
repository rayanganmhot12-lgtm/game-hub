import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

// Game Hub runs locally on the same machine as the user's Steam client, so
// "installed" can be determined by reading Steam's own library metadata
// instead of relying on a manual per-game toggle. Windows-only for now,
// matching the actual deployment target of this app.
async function findSteamPath(): Promise<string | null> {
  if (process.platform !== "win32") return null;

  try {
    const { stdout } = await execAsync('reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath');
    const match = stdout.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (match) return match[1].trim().replace(/\//g, "\\");
  } catch {
    // Registry key missing — fall through to default install locations.
  }

  const fallbacks = ["C:\\Program Files (x86)\\Steam", "C:\\Program Files\\Steam"];
  for (const candidate of fallbacks) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // try next fallback
    }
  }
  return null;
}

// Steam's libraryfolders.vdf lists every library folder (across all drives)
// plus the set of installed app IDs in each one, so a single file read
// covers every install location without walking each library's steamapps
// directory separately.
export async function getInstalledSteamAppIds(): Promise<Set<string> | null> {
  const steamPath = await findSteamPath();
  if (!steamPath) return null;

  const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
  let contents: string;
  try {
    contents = await fs.readFile(vdfPath, "utf-8");
  } catch {
    return null;
  }

  const appIds = new Set<string>();
  const appEntryPattern = /"(\d+)"\s+"\d+"/g;
  let match: RegExpExecArray | null;
  while ((match = appEntryPattern.exec(contents)) !== null) {
    appIds.add(match[1]);
  }
  return appIds;
}
