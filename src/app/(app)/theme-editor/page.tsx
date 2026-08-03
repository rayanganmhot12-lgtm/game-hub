"use client";

import { useState, type CSSProperties } from "react";
import { RotateCcw, Palette, Image as ImageIcon, Check, Sparkles, Gamepad2 } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { ACCENT_PRESETS, MAX_BG_INTENSITY, isValidHex, deriveAccentPalette } from "@/lib/theme";
import PageHeader from "@/components/PageHeader";
import Switch from "@/components/Switch";

// Everything the accent actually shows up in, and none of which appears
// anywhere else on this page — so a colour can be judged where it lives
// instead of by leaving and coming back. Built from the app's own classes
// rather than styled here, so it cannot drift from the real thing.
function AccentPreview() {
  return (
    <div className="panel p-5">
      <h2 className="section-title mb-4">
        <Sparkles size={16} className="text-accent-bright" />
        Preview
      </h2>

      <div className="flex flex-col gap-5">
        <p className="page-title text-[1.75rem]">Game Hub</p>

        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className="btn-primary">
            <Gamepad2 size={14} />
            Primary
          </button>
          <button type="button" className="btn-ghost">
            Ghost
          </button>
          <span className="flex items-center gap-2 rounded-full border border-border/70 bg-surface-2/60 px-3.5 py-1.5 text-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-bright" />
            <span className="text-muted">Chip</span>
          </span>
          <span className="icon-badge h-10 w-10">
            <Palette size={18} />
          </span>
        </div>

        {/* A panel inside the panel, so the accent bloom from the top edge and
            the lit seam across it are both visible against a surface. */}
        <div className="panel p-4">
          <h3 className="section-title mb-3">Nested surface</h3>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={0.62}
            readOnly
            aria-label="Preview slider"
            className="slider pointer-events-none h-3 w-full"
            style={{ "--fill": "62%" } as CSSProperties}
          />
        </div>
      </div>
    </div>
  );
}

function PresetTile({
  name,
  hex,
  active,
  onSelect,
}: {
  name: string;
  hex: string;
  active: boolean;
  onSelect: () => void;
}) {
  // The trio is what actually gets applied. A single dot would show a third of
  // the choice and hide the two shades derived from it.
  const palette = deriveAccentPalette(hex);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
        active ? "border-accent/60 bg-accent/10" : "border-border bg-surface-2/40 hover:border-accent/40"
      }`}
    >
      <span className="flex shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-white/10">
        <span className="h-9 w-4" style={{ backgroundColor: palette.accentBright }} />
        <span className="h-9 w-5" style={{ backgroundColor: palette.accent }} />
        <span className="h-9 w-4" style={{ backgroundColor: palette.accentDim }} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{name}</span>
        <span className="block text-[11px] uppercase tabular-nums text-muted">{hex}</span>
      </span>
      {active && <Check size={15} className="shrink-0 text-accent-bright" />}
    </button>
  );
}

export default function ThemeEditorPage() {
  const { accent, setAccent, bgIntensity, setBgIntensity, bgGrid, setBgGrid, bgGrain, setBgGrain, resetAll } =
    useTheme();

  // Held separately so a half-typed hex doesn't repaint the app on every
  // keystroke — it is applied only once it is a colour.
  const [hexDraft, setHexDraft] = useState(accent);
  // Adjusted during render rather than in an effect. The field has to follow
  // the accent when a preset or reset changes it, and an effect for that runs
  // a second render pass showing the stale value first.
  const [lastAccent, setLastAccent] = useState(accent);
  if (accent !== lastAccent) {
    setLastAccent(accent);
    setHexDraft(accent);
  }

  const activePreset = ACCENT_PRESETS.find((p) => p.hex.toLowerCase() === accent.toLowerCase());

  function commitHex(value: string) {
    const next = value.startsWith("#") ? value : `#${value}`;
    setHexDraft(next);
    if (isValidHex(next)) setAccent(next.toLowerCase());
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Theme Editor"
        subtitle="Changes apply live across the whole app as you make them, and are remembered on this device."
        action={
          <button onClick={resetAll} className="btn-ghost !gap-1.5">
            <RotateCcw size={13} />
            Reset all
          </button>
        }
      />

      <AccentPreview />

      <div className="panel p-5">
        <h2 className="section-title mb-4">
          <Palette size={16} className="text-accent-bright" />
          Accent
        </h2>

        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {ACCENT_PRESETS.map((preset) => (
            <PresetTile
              key={preset.hex}
              name={preset.name}
              hex={preset.hex}
              active={activePreset?.hex === preset.hex}
              onSelect={() => setAccent(preset.hex)}
            />
          ))}
        </div>

        <div className="mt-4 border-t border-border/60 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg ring-1 ring-inset ring-border">
              <span className="block h-full w-full" style={{ backgroundColor: accent }} />
              {/* The native picker is the right tool; its default field is what
                  looked like browser chrome. Hidden behind the swatch, which
                  opens it. */}
              <input
                type="color"
                value={accent}
                onChange={(e) => setAccent(e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
                title="Pick a custom accent colour"
              />
            </label>

            <input
              value={hexDraft}
              onChange={(e) => commitHex(e.target.value)}
              spellCheck={false}
              maxLength={7}
              aria-label="Accent hex"
              className={`input-field w-32 font-mono uppercase ${
                isValidHex(hexDraft) ? "" : "!border-red-500/70"
              }`}
            />

            <span className="text-xs text-muted">
              {activePreset ? `Using ${activePreset.name}` : "Custom colour"}
            </span>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="section-title mb-4">
          <ImageIcon size={16} className="text-accent-bright" />
          Background
        </h2>

        <div className="flex flex-col gap-5">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-foreground">Intensity</span>
              <span className="tabular-nums text-muted">{Math.round(bgIntensity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={MAX_BG_INTENSITY}
              step={0.05}
              value={bgIntensity}
              onChange={(e) => setBgIntensity(parseFloat(e.target.value))}
              aria-label="Background intensity"
              className="slider h-3 w-full"
              style={{ "--fill": `${(bgIntensity / MAX_BG_INTENSITY) * 100}%` } as CSSProperties}
            />
          </div>

          <Switch checked={bgGrid} onChange={setBgGrid} label="Grid pattern" />
          <Switch checked={bgGrain} onChange={setBgGrain} label="Film grain texture" />
        </div>
      </div>
    </div>
  );
}
