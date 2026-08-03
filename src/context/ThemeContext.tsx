"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  CUSTOM_ACCENT_KEY,
  BG_INTENSITY_KEY,
  BG_GRID_KEY,
  BG_GRAIN_KEY,
  DEFAULT_ACCENT,
  DEFAULT_BG_INTENSITY,
  DEFAULT_BG_GRID,
  DEFAULT_BG_GRAIN,
  deriveAccentPalette,
} from "@/lib/theme";

interface ThemeContextValue {
  /** The active accent hex. Never null — a preset is still an accent. */
  accent: string;
  setAccent: (hex: string) => void;
  bgIntensity: number;
  setBgIntensity: (value: number) => void;
  bgGrid: boolean;
  setBgGrid: (value: boolean) => void;
  bgGrain: boolean;
  setBgGrain: (value: boolean) => void;
  /** Accent and background together, back to how the app shipped. */
  resetAll: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// One path for every accent, whether it came from a preset tile or the colour
// picker. There used to be a second one — a data-theme attribute with a CSS
// block overriding these same four variables — which meant a "theme" and a
// "custom colour" were the same act performed two different ways.
function applyAccent(hex: string) {
  const root = document.documentElement.style;
  const palette = deriveAccentPalette(hex);
  root.setProperty("--accent", palette.accent);
  root.setProperty("--accent-bright", palette.accentBright);
  root.setProperty("--accent-dim", palette.accentDim);
  root.setProperty("--accent-rgb", palette.accentRgb);
  window.localStorage.setItem(CUSTOM_ACCENT_KEY, hex);
}

function applyBgIntensity(value: number) {
  document.documentElement.style.setProperty("--bg-intensity", String(value));
  window.localStorage.setItem(BG_INTENSITY_KEY, String(value));
}

function applyBgGrid(value: boolean) {
  document.documentElement.style.setProperty("--bg-grid-intensity", value ? "1" : "0");
  window.localStorage.setItem(BG_GRID_KEY, value ? "1" : "0");
}

function applyBgGrain(value: boolean) {
  document.documentElement.style.setProperty("--bg-grain-intensity", value ? "1" : "0");
  window.localStorage.setItem(BG_GRAIN_KEY, value ? "1" : "0");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [accent, setAccentState] = useState(DEFAULT_ACCENT);
  const [bgIntensity, setBgIntensityState] = useState(DEFAULT_BG_INTENSITY);
  const [bgGrid, setBgGridState] = useState(DEFAULT_BG_GRID);
  const [bgGrain, setBgGrainState] = useState(DEFAULT_BG_GRAIN);

  // Syncs React state with what the blocking script in layout.tsx already put
  // on the document before hydration. It reads storage itself so the first
  // paint is already correct; this only catches state up to it.
  useEffect(() => {
    const storedAccent = window.localStorage.getItem(CUSTOM_ACCENT_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (storedAccent) setAccentState(storedAccent);

    const storedIntensity = window.localStorage.getItem(BG_INTENSITY_KEY);
    const intensity = storedIntensity ? Number(storedIntensity) : DEFAULT_BG_INTENSITY;
    applyBgIntensity(intensity);
    setBgIntensityState(intensity);

    const grid = window.localStorage.getItem(BG_GRID_KEY) !== "0";
    applyBgGrid(grid);
    setBgGridState(grid);

    const grain = window.localStorage.getItem(BG_GRAIN_KEY) !== "0";
    applyBgGrain(grain);
    setBgGrainState(grain);
  }, []);

  function setAccent(hex: string) {
    setAccentState(hex);
    applyAccent(hex);
  }

  function setBgIntensity(value: number) {
    setBgIntensityState(value);
    applyBgIntensity(value);
  }

  function setBgGrid(value: boolean) {
    setBgGridState(value);
    applyBgGrid(value);
  }

  function setBgGrain(value: boolean) {
    setBgGrainState(value);
    applyBgGrain(value);
  }

  function resetAll() {
    setAccent(DEFAULT_ACCENT);
    setBgIntensity(DEFAULT_BG_INTENSITY);
    setBgGrid(DEFAULT_BG_GRID);
    setBgGrain(DEFAULT_BG_GRAIN);
  }

  return (
    <ThemeContext.Provider
      value={{
        accent,
        setAccent,
        bgIntensity,
        setBgIntensity,
        bgGrid,
        setBgGrid,
        bgGrain,
        setBgGrain,
        resetAll,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
