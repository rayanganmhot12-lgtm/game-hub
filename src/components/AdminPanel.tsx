"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function AdminPanel({
  initialNameEffect,
}: {
  initialNameEffect: string | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [nameEffect, setNameEffect] = useState(initialNameEffect);
  const [saving, setSaving] = useState(false);

  async function toggleNameEffect() {
    const enabled = !nameEffect;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/name-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Couldn't update your name effect.");
      const { nameEffect: updated } = await res.json();
      setNameEffect(updated);
      showToast(enabled ? "Animated name enabled." : "Animated name disabled.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update your name effect.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel p-5">
      <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Sparkles size={16} className="text-accent-bright" />
        Animated Name
      </h2>
      <p className="mb-3 text-xs text-muted">
        Shows your display name with a moving two-color gradient, everywhere your name appears.
      </p>
      <button onClick={toggleNameEffect} disabled={saving} className="btn-primary">
        {nameEffect ? "Turn Off" : "Turn On"}
      </button>
    </div>
  );
}
