const { contextBridge, ipcRenderer } = require("electron");

// The only bridge between the page and the main process, and deliberately two
// functions wide rather than a general "invoke anything" escape hatch: the
// renderer is a full web app, and anything exposed here is reachable by every
// script it ever loads.
//
// It exists because Chromium refuses getDisplayMedia inside Electron unless
// the main process answers the request with a source it chose itself, and
// desktopCapturer — the only way to enumerate screens and windows — is main
// process only. See setDisplayMediaRequestHandler in main.js.
contextBridge.exposeInMainWorld("gameHubDesktop", {
  listScreenShareSources: () => ipcRenderer.invoke("screen-share:list-sources"),
  selectScreenShareSource: (sourceId) => ipcRenderer.invoke("screen-share:select", sourceId),
});
