"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  Theme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME,
  CUSTOM_ACCENT_KEY,
  BG_INTENSITY_KEY,
  BG_GRID_KEY,
  BG_GRAIN_KEY,
  deriveAccentPalette,
} from "@/lib/theme";

export type { Theme };
export { THEME_STORAGE_KEY, DEFAULT_THEME };

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  customAccent: string | null;
  setCustomAccent: (hex: string | null) => void;
  bgIntensity: number;
  setBgIntensity: (value: number) => void;
  bgGrid: boolean;
  setBgGrid: (value: boolean) => void;
  bgGrain: boolean;
  setBgGrain: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
}

function applyCustomAccent(hex: string | null) {
  const root = document.documentElement.style;
  if (hex) {
    const palette = deriveAccentPalette(hex);
    root.setProperty("--accent", palette.accent);
    root.setProperty("--accent-bright", palette.accentBright);
    root.setProperty("--accent-dim", palette.accentDim);
    root.setProperty("--accent-rgb", palette.accentRgb);
    window.localStorage.setItem(CUSTOM_ACCENT_KEY, hex);
  } else {
    root.removeProperty("--accent");
    root.removeProperty("--accent-bright");
    root.removeProperty("--accent-dim");
    root.removeProperty("--accent-rgb");
    window.localStorage.removeItem(CUSTOM_ACCENT_KEY);
  }
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
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const [customAccent, setCustomAccentState] = useState<string | null>(null);
  const [bgIntensity, setBgIntensityState] = useState(1);
  const [bgGrid, setBgGridState] = useState(true);
  const [bgGrain, setBgGrainState] = useState(true);

  useEffect(() => {
    // Syncs React state with the data-theme attribute already set by the
    // blocking inline script in layout.tsx (which reads localStorage before
    // hydration to avoid a flash of the wrong theme).
    const current = document.documentElement.getAttribute("data-theme") as Theme | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(current ?? DEFAULT_THEME);

    const storedAccent = window.localStorage.getItem(CUSTOM_ACCENT_KEY);
    if (storedAccent) {
      applyCustomAccent(storedAccent);
      setCustomAccentState(storedAccent);
    }

    const storedIntensity = window.localStorage.getItem(BG_INTENSITY_KEY);
    const intensity = storedIntensity ? Number(storedIntensity) : 1;
    applyBgIntensity(intensity);
    setBgIntensityState(intensity);

    const storedGrid = window.localStorage.getItem(BG_GRID_KEY);
    const grid = storedGrid !== "0";
    applyBgGrid(grid);
    setBgGridState(grid);

    const storedGrain = window.localStorage.getItem(BG_GRAIN_KEY);
    const grain = storedGrain !== "0";
    applyBgGrain(grain);
    setBgGrainState(grain);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    applyTheme(next);
  }

  function toggleTheme() {
    setTheme(theme === "neon-orange" ? "dark-red" : "neon-orange");
  }

  function setCustomAccent(hex: string | null) {
    setCustomAccentState(hex);
    applyCustomAccent(hex);
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

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        customAccent,
        setCustomAccent,
        bgIntensity,
        setBgIntensity,
        bgGrid,
        setBgGrid,
        bgGrain,
        setBgGrain,
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
