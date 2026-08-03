"use client";

import { useTheme } from "@/context/ThemeContext";
import { RotateCcw, Palette } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const PRESET_SWATCHES = ["#ff6b00", "#ff1f2d", "#a855f7", "#14b8a6", "#3b82f6", "#ec4899"];

export default function ThemeEditorPage() {
  const {
    customAccent,
    setCustomAccent,
    bgIntensity,
    setBgIntensity,
    bgGrid,
    setBgGrid,
    bgGrain,
    setBgGrain,
  } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Theme Editor"
        subtitle="Changes apply live across the whole app as you adjust them, and are remembered on this device."
      />

      <div className="panel p-5">
        <h2 className="section-title mb-3">
          <Palette size={16} className="text-accent-bright" />
          Accent Color
        </h2>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={customAccent ?? "#ff6b00"}
            onChange={(e) => setCustomAccent(e.target.value)}
            className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
            title="Pick a custom accent color"
          />
          <div className="flex gap-1.5">
            {PRESET_SWATCHES.map((hex) => (
              <button
                key={hex}
                onClick={() => setCustomAccent(hex)}
                style={{ backgroundColor: hex }}
                className={`h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-surface transition-transform hover:scale-110 ${
                  customAccent === hex ? "ring-white/80" : "ring-transparent"
                }`}
                title={hex}
              />
            ))}
          </div>
          {customAccent && (
            <button onClick={() => setCustomAccent(null)} className="btn-ghost !gap-1.5">
              <RotateCcw size={13} />
              Reset to preset
            </button>
          )}
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="section-title mb-4">Background</h2>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-foreground">Intensity</span>
              <span className="text-muted">{Math.round(bgIntensity * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={2}
              step={0.05}
              value={bgIntensity}
              onChange={(e) => setBgIntensity(parseFloat(e.target.value))}
              className="w-full accent-[var(--accent)]"
            />
          </div>

          <label className="flex items-center justify-between text-sm">
            <span className="text-foreground">Grid pattern</span>
            <input
              type="checkbox"
              checked={bgGrid}
              onChange={(e) => setBgGrid(e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>

          <label className="flex items-center justify-between text-sm">
            <span className="text-foreground">Film grain texture</span>
            <input
              type="checkbox"
              checked={bgGrain}
              onChange={(e) => setBgGrain(e.target.checked)}
              className="h-5 w-5 accent-[var(--accent)]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
