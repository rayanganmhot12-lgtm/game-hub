"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Real fullscreen for one element, via the Fullscreen API.
 *
 * The state is derived from the `fullscreenchange` event rather than tracked
 * by the toggle, because the browser owns the exits we don't: Escape, and the
 * OS leaving fullscreen. Neither reaches our handler, so a locally tracked
 * flag would keep insisting the element is fullscreen after the user has
 * already left it.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setIsFullscreen(document.fullscreenElement === ref.current);
    document.addEventListener("fullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
    };
  }, [ref]);

  const toggle = useCallback(async () => {
    const el = ref.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      // requestFullscreen rejects without a user gesture, and exitFullscreen
      // rejects if something else already left. Neither is worth interrupting
      // a call over; the fullscreenchange listener keeps state honest either way.
    }
  }, [ref]);

  return { isFullscreen, toggle };
}
