"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export interface Position {
  x: number;
  y: number;
}

// Where the window sits before anyone has moved it, and how close to an edge a
// drag may leave it.
const EDGE_MARGIN = 16;

/**
 * Drag a `position: fixed` element by a handle, clamped to the viewport.
 *
 * Pointer events rather than mouse events: pointer capture keeps the drag
 * tracking even when the cursor outruns the element or leaves the window,
 * which a mousemove listener on the handle alone does not.
 *
 * Returns a null position until the first effect has run — the starting corner
 * depends on the rendered width and the viewport, neither of which exists
 * during SSR. Callers should render the element unpositioned until then.
 */
export function useDraggable(
  // Taken rather than created, because the same element is also the one the
  // caller hands to useFullscreen.
  ref: RefObject<HTMLElement | null>,
  storageKey: string,
  disabled: boolean
) {
  const [position, setPosition] = useState<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  // Where inside the element the pointer grabbed it, so the window doesn't
  // jump its top-left corner to the cursor on the first move.
  const grabOffset = useRef<Position | null>(null);
  // Mirrors `position` for the pointerup handler, which needs the final value
  // to persist. Reading it out of a setState updater would run the write twice
  // under StrictMode.
  const latest = useRef<Position | null>(null);

  const clamp = useCallback((pos: Position): Position => {
    const el = ref.current;
    const maxX = Math.max(0, window.innerWidth - (el?.offsetWidth ?? 0));
    const maxY = Math.max(0, window.innerHeight - (el?.offsetHeight ?? 0));
    return {
      x: Math.min(Math.max(pos.x, 0), maxX),
      y: Math.min(Math.max(pos.y, 0), maxY),
    };
  }, [ref]);

  const moveTo = useCallback(
    (next: Position) => {
      const clamped = clamp(next);
      latest.current = clamped;
      setPosition(clamped);
    },
    [clamp]
  );

  useEffect(() => {
    let stored: Position | null = null;
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : null;
      if (typeof parsed?.x === "number" && typeof parsed?.y === "number") stored = parsed;
    } catch {
      // A corrupt entry is not worth failing the window it positions.
    }
    const width = ref.current?.offsetWidth ?? 0;
    moveTo(stored ?? { x: window.innerWidth - width - EDGE_MARGIN, y: EDGE_MARGIN });
  }, [ref, storageKey, moveTo]);

  // A window parked at the bottom-right of a large screen must not be stranded
  // off-screen when that screen gets smaller.
  useEffect(() => {
    const onResize = () => {
      if (latest.current) moveTo(latest.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [moveTo]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (disabled) return;
      // The handle carries buttons. A press on one of those is a press.
      if ((e.target as HTMLElement).closest("button")) return;
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      grabOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [ref, disabled]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const offset = grabOffset.current;
      if (!offset) return;
      moveTo({ x: e.clientX - offset.x, y: e.clientY - offset.y });
    },
    [moveTo]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!grabOffset.current) return;
      grabOffset.current = null;
      setDragging(false);
      e.currentTarget.releasePointerCapture(e.pointerId);
      try {
        if (latest.current) window.localStorage.setItem(storageKey, JSON.stringify(latest.current));
      } catch {
        // Storage being unavailable costs the next session's position, nothing more.
      }
    },
    [storageKey]
  );

  return {
    position,
    dragging,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}
