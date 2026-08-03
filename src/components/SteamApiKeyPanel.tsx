"use client";

import { useEffect, useState } from "react";
import { KeyRound, ExternalLink } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function SteamApiKeyPanel() {
  const { showToast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [lastFour, setLastFour] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/steam-api-key")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setLastFour(data.configured ? data.lastFour : null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!apiKey.trim()) {
      showToast("Enter your Steam API key.", "error");
      return;
    }
    if (apiKey.trim().length < 8) {
      showToast("That doesn't look like a real Steam API key — they're normally much longer.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings/steam-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: apiKey.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save the key.");
      setLastFour(data.lastFour);
      setApiKey("");
      showToast("Saved — your key will be used the next time you sync.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save the key.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel p-4">
      <h2 className="section-title mb-1">
        <KeyRound size={15} className="text-accent-bright" />
        Steam API Key
      </h2>
      <p className="mb-3 text-xs text-muted">
        Needed for your library to actually sync.{" "}
        <a
          href="https://steamcommunity.com/dev/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-accent-bright hover:underline"
        >
          Get your own free key <ExternalLink size={11} />
        </a>{" "}
        then paste it below.
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={lastFour ? `••••••••${lastFour}` : "Paste your Steam API key…"}
          className="input-field flex-1"
        />
        <button onClick={handleSave} disabled={saving} className="btn-primary shrink-0">
          {lastFour ? "Update" : "Save"}
        </button>
      </div>
    </div>
  );
}
