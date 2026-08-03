// What electron/preload.js exposes, and nothing else. Absent in a browser, so
// every caller has to handle null rather than assume the desktop app.
export interface ScreenShareSource {
  id: string;
  name: string;
  kind: "screen" | "window";
  thumbnailDataUrl: string;
}

export interface DesktopBridge {
  listScreenShareSources(): Promise<ScreenShareSource[]>;
  /** Arms the next getDisplayMedia call, or clears the selection with null. */
  selectScreenShareSource(sourceId: string | null): Promise<void>;
}

declare global {
  interface Window {
    gameHubDesktop?: DesktopBridge;
  }
}

export function getDesktopBridge(): DesktopBridge | null {
  if (typeof window === "undefined") return null;
  return window.gameHubDesktop ?? null;
}
