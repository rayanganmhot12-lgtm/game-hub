export type Theme = "neon-orange" | "dark-red";

export const THEME_STORAGE_KEY = "gamehub-theme";
export const DEFAULT_THEME: Theme = "neon-orange";

export const CUSTOM_ACCENT_KEY = "gamehub-custom-accent";
export const BG_INTENSITY_KEY = "gamehub-bg-intensity";
export const BG_GRID_KEY = "gamehub-bg-grid";
export const BG_GRAIN_KEY = "gamehub-bg-grain";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

function darken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}

// Derives the --accent-bright / --accent-dim / --accent-rgb trio from a
// single user-picked hex color, matching the relationship the two built-in
// presets use, so a custom accent slots into the same CSS variable contract.
export function deriveAccentPalette(hex: string) {
  const [r, g, b] = hexToRgb(hex);
  return {
    accent: hex,
    accentBright: lighten(hex, 0.12),
    accentDim: darken(hex, 0.35),
    accentRgb: `${r}, ${g}, ${b}`,
  };
}
