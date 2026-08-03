"use client";

import { useState } from "react";
import { ShieldAlert, MessageSquareWarning, VolumeX, Clock, Ban, ShieldCheck, Trash2, RotateCcw, Megaphone, Send } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { isFirebaseConfigured } from "@/lib/firebase";
import { normalizeFriendCode, formatFriendCode } from "@/lib/friendCode";
import { setModerationState, resetModerationState, sendWarning } from "@/lib/moderationRealtime";
import { sendAnnouncement } from "@/lib/announcementRealtime";

interface ModerationActionLog {
  id: string;
  targetCode: string;
  targetDisplayName: string;
  action: string;
  reason: string | null;
  createdAt: string | Date;
}

interface Friend {
  id: string;
  friendCode: string;
  friendDisplayName: string;
}

const TIMEOUT_OPTIONS = [
  { label: "5 minutes", minutes: 5 },
  { label: "15 minutes", minutes: 15 },
  { label: "1 hour", minutes: 60 },
  { label: "24 hours", minutes: 60 * 24 },
];

export default function ModerationPanel({
  myDisplayName,
  initialActions,
  friends,
}: {
  myDisplayName: string;
  initialActions: ModerationActionLog[];
  friends: Friend[];
}) {
  const { showToast } = useToast();
  const [targetCodeInput, setTargetCodeInput] = useState("");
  const [targetDisplayName, setTargetDisplayName] = useState("");
  const [warningMessage, setWarningMessage] = useState("");
  const [moderatorMessage, setModeratorMessage] = useState("");
  const [timeoutMinutes, setTimeoutMinutes] = useState(TIMEOUT_OPTIONS[0].minutes);
  const [actions, setActions] = useState(initialActions);
  const [busy, setBusy] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState("");
  const [announcing, setAnnouncing] = useState(false);

  async function logAction(action: string, reason?: string, expiresAt?: number) {
    const targetCode = normalizeFriendCode(targetCodeInput);
    const res = await fetch("/api/moderation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        targetCode,
        targetDisplayName: targetDisplayName || targetCode,
        reason,
        expiresAt,
      }),
    });
    if (!res.ok) {
      throw new Error("Couldn't save this action to the log.");
    }
    const { action: entry } = await res.json();
    setActions((prev) => [entry, ...prev]);
  }

  function getTargetCode(): string | null {
    const code = normalizeFriendCode(targetCodeInput);
    if (code.length < 6) {
      showToast("Enter a valid friend code.", "error");
      return null;
    }
    return code;
  }

  async function handleWarn() {
    const code = getTargetCode();
    if (!code || !warningMessage.trim()) {
      if (!warningMessage.trim()) showToast("Write a warning message.", "error");
      return;
    }
    setBusy(true);
    try {
      await sendWarning(code, warningMessage.trim(), myDisplayName);
      await logAction("warn", warningMessage.trim());
      showToast("Warning sent.", "success");
      setWarningMessage("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send warning.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    const code = getTargetCode();
    if (!code || !moderatorMessage.trim()) {
      if (!moderatorMessage.trim()) showToast("Write a message.", "error");
      return;
    }
    setBusy(true);
    try {
      await sendAnnouncement(code, moderatorMessage.trim(), myDisplayName);
      await logAction("message", moderatorMessage.trim());
      showToast("Message sent.", "success");
      setModeratorMessage("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send message.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleMute(muted: boolean) {
    const code = getTargetCode();
    if (!code) return;
    setBusy(true);
    try {
      await setModerationState(code, { muted });
      await logAction(muted ? "mute" : "unmute");
      showToast(muted ? "User muted." : "User unmuted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update mute status.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleTimeout() {
    const code = getTargetCode();
    if (!code) return;
    setBusy(true);
    try {
      const timeoutUntil = Date.now() + timeoutMinutes * 60 * 1000;
      await setModerationState(code, { timeoutUntil });
      await logAction("timeout", `${timeoutMinutes} minutes`, timeoutUntil);
      showToast(`User timed out for ${timeoutMinutes} minutes.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't apply timeout.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveTimeout() {
    const code = getTargetCode();
    if (!code) return;
    setBusy(true);
    try {
      await setModerationState(code, { timeoutUntil: null });
      await logAction("remove timeout");
      showToast("Timeout removed.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't remove timeout.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleBan(banned: boolean) {
    const code = getTargetCode();
    if (!code) return;
    setBusy(true);
    try {
      await setModerationState(code, { banned });
      await logAction(banned ? "ban" : "unban");
      showToast(banned ? "User banned." : "User unbanned.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't update ban status.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    const code = getTargetCode();
    if (!code) return;
    setBusy(true);
    try {
      await resetModerationState(code);
      await logAction("reset");
      showToast("All restrictions cleared for this user.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't reset user.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleAnnounceAll() {
    const message = announceMessage.trim();
    if (!message) {
      showToast("Write an announcement message.", "error");
      return;
    }
    if (friends.length === 0) {
      showToast("You don't have any friends to announce to yet.", "error");
      return;
    }
    setAnnouncing(true);
    try {
      await Promise.all(friends.map((f) => sendAnnouncement(f.friendCode, message, myDisplayName)));
      showToast(`Sent to ${friends.length} friend${friends.length === 1 ? "" : "s"}.`, "success");
      setAnnounceMessage("");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send announcement.", "error");
    } finally {
      setAnnouncing(false);
    }
  }

  async function handleClearHistory() {
    const res = await fetch("/api/moderation", { method: "DELETE" });
    if (res.ok) {
      setActions([]);
      showToast("Moderation history cleared.", "success");
    } else {
      showToast("Couldn't clear history.", "error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {!isFirebaseConfigured && (
        <div className="panel p-6 text-center">
          <p className="text-sm text-muted">
            Moderation actions need a free Firebase project to take effect on other installations. Add your config
            to <code className="text-accent-bright">.env</code> — see the README.
          </p>
        </div>
      )}

      <div className="panel p-5">
        <h2 className="section-title mb-1">
          <Megaphone size={16} className="text-accent-bright" />
          Announce to Everyone
        </h2>
        <p className="mb-3 text-xs text-muted">
          Sends a friendly banner (not a warning) to all {friends.length} friend{friends.length === 1 ? "" : "s"} at
          once.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={announceMessage}
            onChange={(e) => setAnnounceMessage(e.target.value)}
            placeholder="Announcement message…"
            className="input-field flex-1"
          />
          <button
            onClick={handleAnnounceAll}
            disabled={announcing || !isFirebaseConfigured}
            className="btn-primary"
          >
            Send to All
          </button>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="section-title mb-3">
          <ShieldAlert size={16} className="text-accent-bright" />
          Target
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={targetCodeInput}
            onChange={(e) => setTargetCodeInput(e.target.value)}
            placeholder="XXXX-XXXX (friend code)"
            className="input-field flex-1"
          />
          <input
            value={targetDisplayName}
            onChange={(e) => setTargetDisplayName(e.target.value)}
            placeholder="Display name (for the log)"
            className="input-field flex-1"
          />
          <button
            onClick={handleReset}
            disabled={busy || !isFirebaseConfigured}
            title="Clear ban, mute, and timeout for this user in one click"
            className="btn-ghost shrink-0"
          >
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="section-title mb-3">
          <MessageSquareWarning size={16} className="text-accent-bright" />
          Warn
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={warningMessage}
            onChange={(e) => setWarningMessage(e.target.value)}
            placeholder="Warning message shown full-screen to them…"
            className="input-field flex-1"
          />
          <button onClick={handleWarn} disabled={busy || !isFirebaseConfigured} className="btn-primary">
            Send Warning
          </button>
        </div>
      </div>

      <div className="panel p-5">
        <h2 className="section-title mb-3">
          <Send size={16} className="text-accent-bright" />
          Send Message
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={moderatorMessage}
            onChange={(e) => setModeratorMessage(e.target.value)}
            placeholder="Message shown as a friendly notification…"
            className="input-field flex-1"
          />
          <button onClick={handleSendMessage} disabled={busy || !isFirebaseConfigured} className="btn-primary">
            Send Message
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="panel p-5">
          <h2 className="section-title mb-3">
            <VolumeX size={16} className="text-accent-bright" />
            Mute
          </h2>
          <div className="flex gap-2">
            <button onClick={() => handleMute(true)} disabled={busy || !isFirebaseConfigured} className="btn-primary flex-1 !text-xs">
              Mute
            </button>
            <button onClick={() => handleMute(false)} disabled={busy || !isFirebaseConfigured} className="btn-ghost flex-1 !text-xs">
              Unmute
            </button>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="section-title mb-3">
            <Clock size={16} className="text-accent-bright" />
            Timeout
          </h2>
          <select
            value={timeoutMinutes}
            onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
            className="input-field mb-2 w-full"
          >
            {TIMEOUT_OPTIONS.map((opt) => (
              <option key={opt.minutes} value={opt.minutes}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button onClick={handleTimeout} disabled={busy || !isFirebaseConfigured} className="btn-primary flex-1 !text-xs">
              Apply Timeout
            </button>
            <button onClick={handleRemoveTimeout} disabled={busy || !isFirebaseConfigured} className="btn-ghost flex-1 !text-xs">
              Remove Timeout
            </button>
          </div>
        </div>

        <div className="panel p-5">
          <h2 className="section-title mb-3">
            <Ban size={16} className="text-accent-bright" />
            Ban
          </h2>
          <div className="flex gap-2">
            <button onClick={() => handleBan(true)} disabled={busy || !isFirebaseConfigured} className="btn-primary flex-1 !text-xs">
              Ban
            </button>
            <button onClick={() => handleBan(false)} disabled={busy || !isFirebaseConfigured} className="btn-ghost flex-1 !text-xs">
              Unban
            </button>
          </div>
        </div>
      </div>

      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="section-title">
            <ShieldCheck size={16} className="text-accent-bright" />
            Recent Actions
          </h2>
          {actions.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="btn-ghost !px-2.5 !py-1 !text-xs text-muted hover:text-red-400"
              title="Clear history"
            >
              <Trash2 size={13} />
              Clear
            </button>
          )}
        </div>
        {actions.length === 0 ? (
          <p className="text-sm text-muted">No moderation actions yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {actions.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                <span className="text-foreground">
                  <span className="font-semibold uppercase text-accent-bright">{a.action}</span>{" "}
                  {a.targetDisplayName} ({formatFriendCode(a.targetCode)})
                  {a.reason ? ` — ${a.reason}` : ""}
                </span>
                <span className="shrink-0 text-muted">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
