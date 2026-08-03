"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { normalizeFriendCode } from "@/lib/friendCode";
import { grantAdminBadge, revokeAdminBadge } from "@/lib/moderationRealtime";

type GrantableBadge = "badge-developer" | "badge-admin";

const DEFAULT_COLOR_1 = "#391fff";
const DEFAULT_COLOR_2 = "#a855f7";

export default function AdminPanel({
  initialNameEffect,
  initialColor1,
  initialColor2,
}: {
  initialNameEffect: string | null;
  initialColor1: string | null;
  initialColor2: string | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [nameEffect, setNameEffect] = useState(initialNameEffect);
  const [saving, setSaving] = useState(false);
  const [color1, setColor1] = useState(initialColor1 ?? DEFAULT_COLOR_1);
  const [color2, setColor2] = useState(initialColor2 ?? DEFAULT_COLOR_2);
  const [savingColors, setSavingColors] = useState(false);
  const [badgeCodeInput, setBadgeCodeInput] = useState("");
  const [badgeBusy, setBadgeBusy] = useState(false);

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

  async function saveColors() {
    setSavingColors(true);
    try {
      const res = await fetch("/api/admin/name-effect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color1, color2 }),
      });
      if (!res.ok) throw new Error("Couldn't save your colors.");
      showToast("Gradient colors saved.", "success");
      router.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't save your colors.", "error");
    } finally {
      setSavingColors(false);
    }
  }

  function getBadgeTargetCode(): string | null {
    const code = normalizeFriendCode(badgeCodeInput);
    if (code.length < 6) {
      showToast("Enter a valid friend code.", "error");
      return null;
    }
    return code;
  }

  function badgeLabel(badgeId: GrantableBadge): string {
    return badgeId === "badge-admin" ? "ADMIN" : "DEV";
  }

  async function handleGrantBadge(badgeId: GrantableBadge) {
    const code = getBadgeTargetCode();
    if (!code) return;
    setBadgeBusy(true);
    try {
      await grantAdminBadge(code, badgeId);
      showToast(`Granted ${badgeLabel(badgeId)} badge.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't grant badge.", "error");
    } finally {
      setBadgeBusy(false);
    }
  }

  async function handleRevokeBadge(badgeId: GrantableBadge) {
    const code = getBadgeTargetCode();
    if (!code) return;
    setBadgeBusy(true);
    try {
      await revokeAdminBadge(code, badgeId);
      showToast(`Revoked ${badgeLabel(badgeId)} badge.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't revoke badge.", "error");
    } finally {
      setBadgeBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="panel p-5">
        <h2 className="section-title mb-1">
          <Sparkles size={16} className="text-accent-bright" />
          Animated Name
        </h2>
        <p className="mb-3 text-xs text-muted">
          Shows your display name with a moving two-color gradient, everywhere your name appears.
        </p>
        <button onClick={toggleNameEffect} disabled={saving} className="btn-primary mb-4">
          {nameEffect ? "Turn Off" : "Turn On"}
        </button>

        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Gradient Colors</p>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="color"
              value={color1}
              onChange={(e) => setColor1(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            Color 1
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="color"
              value={color2}
              onChange={(e) => setColor2(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded border border-border bg-transparent p-0.5"
            />
            Color 2
          </label>
          <button onClick={saveColors} disabled={savingColors} className="btn-ghost !text-xs">
            Save Colors
          </button>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="section-title mb-1">
          <ShieldCheck size={16} className="text-accent-bright" />
          Grant DEV / ADMIN Badge
        </h2>
        <p className="mb-3 text-xs text-muted">
          Shows instantly on their profile and member lists — doesn&apos;t touch their own account data.
        </p>
        <input
          value={badgeCodeInput}
          onChange={(e) => setBadgeCodeInput(e.target.value)}
          placeholder="XXXX-XXXX (friend code)"
          className="input-field mb-3 w-full"
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <button onClick={() => handleGrantBadge("badge-developer")} disabled={badgeBusy} className="btn-primary flex-1">
            Grant DEV
          </button>
          <button onClick={() => handleRevokeBadge("badge-developer")} disabled={badgeBusy} className="btn-ghost flex-1">
            Revoke DEV
          </button>
          <button onClick={() => handleGrantBadge("badge-admin")} disabled={badgeBusy} className="btn-primary flex-1">
            Grant ADMIN
          </button>
          <button onClick={() => handleRevokeBadge("badge-admin")} disabled={badgeBusy} className="btn-ghost flex-1">
            Revoke ADMIN
          </button>
        </div>
      </div>
    </div>
  );
}
