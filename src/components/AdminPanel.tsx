"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ShieldCheck } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { normalizeFriendCode } from "@/lib/friendCode";
import { grantAdminBadge, revokeAdminBadge } from "@/lib/moderationRealtime";

type GrantableBadge = "badge-developer" | "badge-admin";

export default function AdminPanel({
  initialNameEffect,
}: {
  initialNameEffect: string | null;
}) {
  const { showToast } = useToast();
  const router = useRouter();
  const [nameEffect, setNameEffect] = useState(initialNameEffect);
  const [saving, setSaving] = useState(false);
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

      <div className="panel p-5">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
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
