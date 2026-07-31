"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Download } from "lucide-react";

export default function InstalledToggle({
  id,
  initialInstalled,
  platform,
}: {
  id: string;
  initialInstalled: boolean;
  platform?: string;
}) {
  const router = useRouter();
  const [installed, setInstalled] = useState(initialInstalled);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    const next = !installed;
    setInstalled(next);
    try {
      await fetch(`/api/games/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installed: next }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={toggle}
        disabled={saving}
        title={platform === "STEAM" ? "Auto-detected from this PC on each sync — click to override until next sync" : undefined}
        className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 ${
          installed
            ? "border-accent/40 bg-accent/10 text-accent-bright shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.15)]"
            : "border-border text-muted hover:border-accent/40 hover:text-foreground"
        }`}
      >
        {installed ? <Check size={16} /> : <Download size={16} />}
        {installed ? "Installed" : "Mark as Installed"}
      </button>
      {platform === "STEAM" && <p className="text-[11px] text-muted">Auto-detected on sync</p>}
    </div>
  );
}
