"use client";

import { useEffect, useRef, useState } from "react";
import type { Track } from "@/context/MusicPlayerContext";

// Three at a time: enough that a normal playlist resolves almost at once, few
// enough that a large one doesn't open a connection per track the instant the
// page mounts.
const MAX_CONCURRENT_PROBES = 3;

/**
 * A self-contained queue of metadata reads. Deliberately plain JavaScript
 * rather than hooks: it is recursive (each finished probe starts the next),
 * and it has to survive the list identity changing under it, neither of which
 * a `useCallback` expresses well.
 */
function createDurationProbe(onResolved: (id: string, seconds: number) => void) {
  const handled = new Set<string>();
  const queue: string[] = [];
  let active = 0;
  let stopped = false;

  function pump() {
    while (!stopped && active < MAX_CONCURRENT_PROBES && queue.length > 0) {
      const id = queue.shift();
      if (!id) return;
      active += 1;

      const audio = new Audio();
      audio.preload = "metadata";

      // Releasing the element can itself fire `error`, so the two handlers
      // have to agree on who finished first, or the in-flight count drifts
      // down and the queue runs more probes than the limit allows.
      let settled = false;
      const finish = (seconds?: number) => {
        if (settled) return;
        settled = true;
        audio.removeAttribute("src");
        audio.load();
        active -= 1;
        if (stopped) return;
        if (seconds !== undefined && Number.isFinite(seconds) && seconds > 0) {
          onResolved(id, seconds);
        }
        pump();
      };

      audio.addEventListener("loadedmetadata", () => finish(audio.duration), { once: true });
      audio.addEventListener("error", () => finish(), { once: true });
      audio.src = `/api/playlist/${id}/file`;
    }
  }

  return {
    // Ids already handled are skipped, including ones whose metadata failed to
    // load: the caller renders those as unknown, and retrying on every reorder
    // would be a request loop in exchange for a dash.
    enqueue(ids: string[]) {
      let added = false;
      for (const id of ids) {
        if (handled.has(id)) continue;
        handled.add(id);
        queue.push(id);
        added = true;
      }
      if (added) pump();
    },
    stop() {
      stopped = true;
    },
  };
}

/**
 * Durations in seconds, keyed by track id, read from the audio files.
 *
 * `Track` has no duration column, and adding one would still leave the bundled
 * tracks — which were never uploaded through this app — without a value. The
 * file route answers Range requests, so `preload="metadata"` pulls the header
 * rather than the whole file.
 */
export function useTrackDurations(tracks: Track[]) {
  const [durations, setDurations] = useState<Record<string, number>>({});
  const probeRef = useRef<ReturnType<typeof createDurationProbe> | null>(null);

  useEffect(() => {
    // The probe outlives the list it was handed. Rebuilding it whenever
    // `tracks` changes identity — which it does on every upload, delete and
    // reorder — would abandon whatever was in flight at that moment.
    const probe = (probeRef.current ??= createDurationProbe((id, seconds) =>
      setDurations((prev) => ({ ...prev, [id]: seconds }))
    ));
    probe.enqueue(tracks.map((t) => t.id));
  }, [tracks]);

  useEffect(
    () => () => {
      probeRef.current?.stop();
      probeRef.current = null;
    },
    []
  );

  return durations;
}
