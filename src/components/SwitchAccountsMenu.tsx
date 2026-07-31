"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Check, Users, UserPlus, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import { useToast } from "@/context/ToastContext";

interface SavedAccountInfo {
  userId: string;
  email: string;
  displayName: string;
}

interface MeResponse {
  user: { id: string; email: string; displayName: string } | null;
  savedAccounts: SavedAccountInfo[];
}

// A real Discord-style account switcher — up to 5 accounts can be
// logged into on this device at once (see docs/superpowers/specs/
// 2026-07-31-switch-accounts-design.md). Self-contained: fetches its own
// /api/me data the first time it's opened, so the parent (FriendProfileModal)
// doesn't need to know anything about the saved-accounts list.
export default function SwitchAccountsMenu() {
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [adding, setAdding] = useState(false);

  async function loadMe() {
    try {
      const res = await fetch("/api/me");
      if (!res.ok) {
        showToast("Couldn't load your accounts.", "error");
        setLoaded(true);
        return;
      }
      const data = (await res.json()) as MeResponse;
      setMe(data);
      setLoaded(true);
    } catch {
      showToast("Couldn't load your accounts.", "error");
      setLoaded(true);
    }
  }

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) loadMe();
  }

  async function switchTo(userId: string) {
    setSwitchingTo(userId);
    try {
      const res = await fetch("/api/auth/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLoaded(false);
        setMe(null);
        setOpen(false);
        router.push("/dashboard");
        router.refresh();
      } else {
        showToast(data.error ?? "Couldn't switch accounts.", "error");
      }
    } catch {
      showToast("Couldn't switch accounts.", "error");
    } finally {
      setSwitchingTo(null);
    }
  }

  async function submitAddAccount(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: addEmail, password: addPassword, addAccount: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setLoaded(false);
        setMe(null);
        setOpen(false);
        setAddOpen(false);
        setAddEmail("");
        setAddPassword("");
        router.push("/dashboard");
        router.refresh();
      } else {
        showToast(data.error ?? "Couldn't add that account.", "error");
      }
    } catch {
      showToast("Couldn't add that account.", "error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/60 bg-surface-2/30 text-xs text-foreground">
      <button
        onClick={toggleOpen}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 transition-colors hover:bg-surface-2/60"
      >
        <span className="flex items-center gap-2">
          <Users size={13} />
          Switch Accounts
        </span>
        <ChevronRight size={13} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-border/60 py-1">
          {!loaded ? (
            <p className="px-4 py-2 text-muted">Loading…</p>
          ) : (
            <>
              {me?.user && (
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <Avatar name={me.user.displayName} size={20} />
                  <span className="min-w-0 flex-1 truncate">{me.user.displayName}</span>
                  <Check size={13} className="shrink-0 text-accent-bright" />
                </div>
              )}
              {me?.savedAccounts?.map((acc) => (
                <button
                  key={acc.userId}
                  onClick={() => switchTo(acc.userId)}
                  disabled={switchingTo === acc.userId}
                  className="flex w-full items-center gap-2 px-4 py-1.5 text-left transition-colors hover:bg-surface-2/60"
                >
                  <Avatar name={acc.displayName} size={20} />
                  <span className="min-w-0 flex-1 truncate">{acc.displayName}</span>
                </button>
              ))}
              <button
                onClick={() => setAddOpen(true)}
                className="flex w-full items-center gap-2 border-t border-border/60 px-4 py-1.5 text-left text-accent-bright transition-colors hover:bg-surface-2/60"
              >
                <UserPlus size={13} />
                Add Another Account
              </button>
            </>
          )}
        </div>
      )}

      {addOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 px-4"
          onClick={() => setAddOpen(false)}
        >
          <form
            onSubmit={submitAddAccount}
            onClick={(e) => e.stopPropagation()}
            className="panel relative w-full max-w-xs !p-5 text-left"
          >
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="absolute right-3 top-3 text-muted hover:text-foreground"
            >
              <X size={16} />
            </button>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Add Another Account</h2>
            <input
              type="email"
              required
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Email"
              className="input-field mb-2 w-full"
            />
            <input
              type="password"
              required
              value={addPassword}
              onChange={(e) => setAddPassword(e.target.value)}
              placeholder="Password"
              className="input-field mb-4 w-full"
            />
            <button type="submit" disabled={adding} className="btn-primary w-full">
              Log In
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
