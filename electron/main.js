const { app, BrowserWindow, Tray, Menu, nativeImage, session, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const { spawn } = require("child_process");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const PORT = 3000;
const APP_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.join(__dirname, "..");
const ICON_PATH = path.join(__dirname, "icon.png");

let serverProcess = null;
let mainWindow = null;
let tray = null;
let isQuitting = false;

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

  const serverPath = path.join(process.resourcesPath, "standalone", "server.js");
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    stdio: "inherit",
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: "production",
      SESSION_SECRET: getOrCreateSessionSecret(),
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      showWindow();
    }
  });
});

function stopServer() {
  if (!serverProcess) return;
  const pid = serverProcess.pid;
  const proc = serverProcess;
  serverProcess = null;

  if (process.platform === "win32") {
    // serverProcess is a cmd.exe wrapper (spawned with shell: true) — killing
    // it alone leaves the actual node/next dev processes it forked running.
    // /t kills the whole process tree.
    spawn("taskkill", ["/pid", String(pid), "/t", "/f"]);
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
