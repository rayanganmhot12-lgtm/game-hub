const { app, BrowserWindow, Tray, Menu, nativeImage, session, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const { spawn, execFileSync } = require("child_process");
const { autoUpdater } = require("electron-updater");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PORT = 3000;
const APP_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.join(__dirname, "..");
const ICON_PATH = path.join(__dirname, "icon.png");

let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;
let installInFlight = false;

function waitForServer(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      http
        .get(url, (res) => {
          res.destroy();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error("Game Hub server did not start in time"));
          } else {
            setTimeout(check, 300);
          }
        });
    };
    check();
  });
}

// Every packaged install gets its own persistent, randomly-generated
// SESSION_SECRET on first launch — never the developer's own value from a
// bundled .env, since sharing one secret across every friend's copy would
// let any install decrypt or forge another's session cookie.
function getOrCreateSessionSecret() {
  const secretsPath = path.join(app.getPath("userData"), "secrets.json");
  try {
    const existing = JSON.parse(fs.readFileSync(secretsPath, "utf8"));
    if (existing.sessionSecret) return existing.sessionSecret;
  } catch {
    // Missing or corrupt — fall through and generate a fresh one.
  }
  const sessionSecret = crypto.randomBytes(32).toString("hex");
  fs.writeFileSync(secretsPath, JSON.stringify({ sessionSecret }));
  return sessionSecret;
}

// The live database and uploaded music files must live in Electron's
// userData directory, never inside the install directory: NSIS's update
// flow deletes the entire install directory on every update (its
// uninstaller runs an atomicRMDir over $INSTDIR), so anything left there —
// a friend's account, library, chat history, or uploaded playlist — would
// be silently wiped the first time they accept an update. userData is
// untouched by updates and by the uninstaller's /KEEP_APP_DATA path.
function ensureUserData() {
  const userDataDir = app.getPath("userData");
  fs.mkdirSync(userDataDir, { recursive: true });
  const seedResourcesDir = path.join(process.resourcesPath, "standalone");

  const dbPath = path.join(userDataDir, "dev.db");
  if (!fs.existsSync(dbPath)) {
    fs.copyFileSync(path.join(seedResourcesDir, "dev.db"), dbPath);
  }

  const uploadsDir = path.join(userDataDir, "uploads", "music");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    const seedUploadsDir = path.join(seedResourcesDir, "uploads", "music");
    if (fs.existsSync(seedUploadsDir)) {
      for (const file of fs.readdirSync(seedUploadsDir)) {
        fs.copyFileSync(path.join(seedUploadsDir, file), path.join(uploadsDir, file));
      }
    }
  }

  return { dbPath, userDataDir };
}

function startServer() {
  const isPackaged = app.isPackaged;

  if (!isPackaged) {
    serverProcess = spawn("npm run dev", {
      cwd: PROJECT_ROOT,
      stdio: "inherit",
      shell: true,
    });
    return;
  }

  let dbPath, userDataDir;
  try {
    ({ dbPath, userDataDir } = ensureUserData());
  } catch (err) {
    // A full/locked disk or an antivirus quarantine could make this throw —
    // without a database path there is nothing useful the server can do, so
    // fail loudly instead of an unhandled rejection crashing with no
    // explanation.
    dialog.showErrorBox("Game Hub couldn't start", `Failed to prepare its data folder:\n\n${err.message}`);
    app.quit();
    return;
  }
  const serverPath = path.join(process.resourcesPath, "standalone", "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      SESSION_SECRET: getOrCreateSessionSecret(),
      DATABASE_URL: `file:${dbPath.replace(/\\/g, "/")}`,
      GAMEHUB_DATA_DIR: userDataDir,
      // The packaged app has no separate Node.js binary bundled — this tells
      // Electron's own binary to behave as plain Node instead of launching a
      // second GUI instance when we spawn it to run server.js.
      ELECTRON_RUN_AS_NODE: "1",
    },
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: "#0a0908",
    autoHideMenuBar: true,
    title: "Game Hub",
    icon: ICON_PATH,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Minimize to tray instead of quitting — the music player and sync
  // should be able to keep running in the background.
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function showWindow() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

// Reads the session cookie straight from Electron's shared cookie jar so
// separate processes (tray, Discord presence poller) can call the app's own
// API as the logged-in user, without any custom IPC plumbing.
function callApi(pathname) {
  return new Promise((resolve) => {
    session.defaultSession.cookies
      .get({ url: APP_URL })
      .then((cookies) => {
        const sessionCookie = cookies.find((c) => c.name === "gamehub_session");
        if (!sessionCookie) {
          resolve(null);
          return;
        }
        const req = http.get(
          `${APP_URL}${pathname}`,
          { headers: { Cookie: `gamehub_session=${sessionCookie.value}` } },
          (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(null);
              }
            });
          }
        );
        req.on("error", () => resolve(null));
      })
      .catch(() => resolve(null));
  });
}

async function fetchTopGames() {
  const data = await callApi("/api/games/top");
  return data?.games ?? [];
}

async function buildTrayMenu() {
  const openAtLogin = app.getLoginItemSettings().openAtLogin;
  const topGames = await fetchTopGames();

  const template = [{ label: "Open Game Hub", click: showWindow }];

  if (topGames.length > 0) {
    template.push({ type: "separator" });
    template.push({
      label: "Quick Launch",
      submenu: topGames.map((g) => ({
        label: g.title,
        click: () => shell.openExternal(`steam://run/${g.platformGameId}`),
      })),
    });
  }

  template.push(
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: openAtLogin,
      click: (menuItem) => {
        app.setLoginItemSettings({ openAtLogin: menuItem.checked });
      },
    },
    { type: "separator" },
    {
      label: "Quit Game Hub",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    }
  );

  return Menu.buildFromTemplate(template);
}

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Game Hub");
  tray.on("click", showWindow);
  // Built fresh on every right-click (instead of a static setContextMenu)
  // so "Quick Launch" always reflects current playtime/login state.
  tray.on("right-click", async () => {
    const menu = await buildTrayMenu();
    tray.popUpContextMenu(menu);
  });
}

// Optional: shows what you're playing (via Steam's own "currently in-game"
// status) or that you're browsing Game Hub, in your Discord profile. No-ops
// entirely if DISCORD_CLIENT_ID isn't set or Discord isn't running/reachable
// — this is a bonus, never something that should block the app from working.
const DISCORD_PRESENCE_INTERVAL_MS = 60 * 1000;
let discordClient = null;

async function setupDiscordPresence() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  if (!clientId) return;

  const RPC = require("discord-rpc");
  discordClient = new RPC.Client({ transport: "ipc" });

  discordClient.on("ready", () => {
    updateDiscordPresence();
    setInterval(updateDiscordPresence, DISCORD_PRESENCE_INTERVAL_MS);
  });

  try {
    await discordClient.login({ clientId });
  } catch {
    // Discord not running, or the client ID is invalid — silently skip.
    discordClient = null;
  }
}

async function updateDiscordPresence() {
  if (!discordClient) return;
  const status = await callApi("/api/me/status");
  const playing = status?.playing;

  try {
    await discordClient.setActivity({
      details: playing ? `Playing ${playing}` : "Browsing Game Hub",
      state: playing ? "via Game Hub" : "Managing their library",
      largeImageKey: "gamehub_logo",
      startTimestamp: Date.now(),
      instance: false,
    });
  } catch {
    // Best-effort — a single failed presence update isn't worth surfacing.
  }
}

// Checks GitHub Releases for a newer version and prompts before doing
// anything — never a silent/forced update. Only runs in packaged builds;
// there is nothing to "update" in a dev checkout.
const UPDATE_CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours — the app is
// designed to keep running in the tray for long stretches, so a single
// on-launch check isn't enough to reach people in a reasonable time.

function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;

  autoUpdater.on("update-available", async (info) => {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: "info",
      title: "Update available",
      message: `Game Hub ${info.version} is available. Update now?`,
      buttons: ["Update Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on("update-downloaded", () => {
    // Stop the server first (and wait for it — stopServer is synchronous)
    // so its open file handles on the install directory are released before
    // NSIS tries to replace it. Install silently (isSilent) and relaunch
    // automatically (isForceRunAfter) for the seamless update experience the
    // design calls for, rather than re-running the full first-install wizard.
    installInFlight = true;
    stopServer();
    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.on("error", (err) => {
    // A failed update check must never block the app from working normally.
    console.error("Auto-update check failed:", err);
    // If this error happened after we'd already stopped the server to
    // install (e.g. the installer couldn't launch), quitAndInstall's own
    // app.quit() is never reached — restart the server so the user isn't
    // left staring at a dead app instead of just missing this update.
    if (installInFlight) {
      installInFlight = false;
      startServer();
    }
  });

  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);
}

app.whenReady().then(async () => {
  startServer();
  try {
    await waitForServer(APP_URL);
  } catch (err) {
    console.error(err);
    app.quit();
    return;
  }
  createWindow();
  createTray();
  setupDiscordPresence();
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showWindow();
    }
  });
});

// Synchronous so callers can rely on the server having actually exited
// before proceeding — critical for the auto-update path below, where NSIS's
// uninstall step fails or hangs if the server still holds the native
// .node addon's file handle open when it tries to delete the install
// directory.
function stopServer() {
  if (!serverProcess) return;
  const pid = serverProcess.pid;
  const proc = serverProcess;
  serverProcess = null;

  if (process.platform === "win32") {
    // In dev, serverProcess is a cmd.exe wrapper (spawned with shell: true)
    // whose forked node/next children would otherwise survive it; in the
    // packaged build it's the server process itself. /t kills the whole
    // tree either way. A timeout keeps a hung taskkill from freezing the
    // main process forever (it previously ran fire-and-forget, so this is
    // a new failure mode being guarded against, not a regression).
    try {
      execFileSync("taskkill", ["/pid", String(pid), "/t", "/f"], { timeout: 10000, windowsHide: true });
    } catch {
      // Already exited, or timed out — either way, move on.
    }
  } else {
    proc.kill();
  }
}

app.on("window-all-closed", () => {
  // Do nothing here — the tray keeps the app alive. Actual quitting happens
  // via the tray's "Quit Game Hub" item, which sets isQuitting first.
});

app.on("before-quit", () => {
  isQuitting = true;
  stopServer();
});
