const { desktopCapturer, ipcMain } = require("electron");

// Screen sharing does not work in Electron the way it does in a browser.
// navigator.mediaDevices.getDisplayMedia exists, but Chromium rejects it with
// NotSupportedError unless the main process registers a handler and answers
// with a source — there is no built-in picker on Windows, and desktopCapturer,
// the only way to enumerate screens and windows, is main-process only. Without
// all of this the share button fails on every press, while the camera and
// microphone, which Electron grants by default, work fine.
//
// The page picks first and captures second: it lists sources, shows its own
// picker, tells us the chosen id, and only then calls getDisplayMedia, which
// this handler answers from the selection already made. Denying a request
// after the fact reaches the page as AbortError, which it cannot tell apart
// from a genuine failure — so cancelling the picker never calls
// getDisplayMedia at all.
//
// Its own module rather than another block in main.js so the whole chain —
// these channel names, preload.js, and the handler — can be exercised by a
// probe without booting the app and its server.
function registerScreenSharing(session) {
  let sources = [];
  let pendingSourceId = null;

  ipcMain.handle("screen-share:list-sources", async () => {
    sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map((source) => ({
      id: source.id,
      name: source.name,
      kind: source.id.startsWith("screen:") ? "screen" : "window",
      thumbnailDataUrl: source.thumbnail.toDataURL(),
    }));
  });

  ipcMain.handle("screen-share:select", (_event, sourceId) => {
    pendingSourceId = typeof sourceId === "string" ? sourceId : null;
  });

  session.setDisplayMediaRequestHandler((_request, callback) => {
    const source = sources.find((s) => s.id === pendingSourceId);
    // One capture per selection, so a stale id can never satisfy a later
    // request the user did not make.
    pendingSourceId = null;
    callback(source ? { video: source } : {});
  });
}

module.exports = { registerScreenSharing };
