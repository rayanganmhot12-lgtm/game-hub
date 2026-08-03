// There used to be a `Theme` here — a data-theme attribute with a matching
// block in globals.css — but that block overrode exactly the four variables
// below, which is precisely what an accent does. A theme was a named colour and
// nothing else, so the two are one thing now: presets and custom values that
// all take the same path.
export interface AccentPreset {
  name: string;
  hex: string;
}

// The first two were the accents of the old "neon-orange" and "dark-red"
// themes. They were already in this list as unnamed swatches, which is the
// plainest evidence the two systems were duplicates.
export const ACCENT_PRESETS: AccentPreset[] = [
  { name: "Neon Orange", hex: "#ff6b00" },
  { name: "Dark Red", hex: "#ff1f2d" },
  { name: "Violet", hex: "#a855f7" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Azure", hex: "#3b82f6" },
  { name: "Rose", hex: "#ec4899" },
];

export const DEFAULT_ACCENT = ACCENT_PRESETS[0].hex;

export const CUSTOM_ACCENT_KEY = "gamehub-custom-accent";
export const BG_INTENSITY_KEY = "gamehub-bg-intensity";
export const BG_GRID_KEY = "gamehub-bg-grid";
export const BG_GRAIN_KEY = "gamehub-bg-grain";

// Named so reset has one definition of "back to how it shipped" instead of the
// same literals repeated at each call site.
export const DEFAULT_BG_INTENSITY = 1;
export const DEFAULT_BG_GRID = true;
export const DEFAULT_BG_GRAIN = true;
export const MAX_BG_INTENSITY = 2;

// Six digits only. The three-digit shorthand would have to be expanded before
// hexToRgb could read it, and a picker never produces one.
export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

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
