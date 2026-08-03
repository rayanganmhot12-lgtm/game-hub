import type { ScreenShareSource } from "@/lib/desktopBridge";

// acquireScreenTrack is a plain async function, not a component, but it has to
// put a modal on screen and wait for an answer. This is the seam: the mounted
// picker registers itself here, and the capture code asks for a choice without
// knowing anything about React.
type PickerOpener = (sources: ScreenShareSource[]) => Promise<ScreenShareSource | null>;

let openPicker: PickerOpener | null = null;

export function registerScreenSharePicker(opener: PickerOpener | null) {
  openPicker = opener;
}

export function pickScreenShareSource(sources: ScreenShareSource[]) {
  // Resolving null here would read as "the user cancelled" and share nothing,
  // silently, forever. A missing picker is a wiring bug and should say so.
  if (!openPicker) {
    throw new Error("The screen picker isn't mounted.");
  }
  return openPicker(sources);
}
