"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, AlertCircle, ArrowUp } from "lucide-react";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const registering = mode === "register";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="panel w-full max-w-sm p-6">
      <div className="relative mb-5 flex rounded-lg border border-border p-1 text-sm">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            data-testid={m === "login" ? "auth-tab-login" : "auth-tab-register"}
            onClick={() => {
              setMode(m);
              // The old mode's failure has nothing to say about the new one.
              setError(null);
            }}
            className={`relative z-10 flex-1 rounded-md px-3 py-1.5 font-medium transition-colors active:scale-95 ${
              mode === m ? "text-black" : "text-muted hover:text-foreground"
            }`}
          >
            {mode === m && (
              <motion.div
                layoutId="auth-tab-pill"
                className="absolute inset-0 -z-10 rounded-md bg-gradient-to-br from-accent-bright to-accent"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            {m === "login" ? "Sign In" : "Sign Up"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-email" className="text-xs font-medium text-muted">
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoFocus
            // Lets a password manager recognise the pair and offer to save it,
            // which is the durable fix for a forgotten password — more so than
            // anything else on this screen.
            autoComplete="email"
            data-testid="auth-email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field w-full"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="auth-password" className="text-xs font-medium text-muted">
            Password
          </label>
          <div className="relative">
            <input
              id="auth-password"
              type={revealed ? "text" : "password"}
              required
              // Registration only. On sign-in this refused submission through a
              // native browser tooltip instead of the app's own error, and shut
              // out any shorter password that predates the rule.
              minLength={registering ? 8 : undefined}
              autoComplete={registering ? "new-password" : "current-password"}
              data-testid="auth-password"
              placeholder={registering ? "At least 8 characters" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              // getModifierState is the only way to know: there is no caps-lock
              // event, so it is read off whatever key was just pressed.
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
              onBlur={() => setCapsLock(false)}
              className="input-field w-full pr-11"
            />
            <button
              type="button"
              onClick={() => setRevealed((v) => !v)}
              title={revealed ? "Hide password" : "Show password"}
              aria-label={revealed ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted transition-colors hover:text-foreground"
            >
              {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {capsLock && (
            <p className="flex items-center gap-1.5 text-xs text-amber-300">
              <ArrowUp size={12} />
              Caps Lock is on
            </p>
          )}
        </div>

        {error && (
          // Framed rather than a bare red sentence between the fields and the
          // button, where it was easy to miss on a dark background.
          <p className="flex items-start gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            {error}
          </p>
        )}

        <button type="submit" data-testid="auth-submit" disabled={loading} className="btn-primary">
          {loading && <Loader2 className="animate-spin" size={16} />}
          {registering ? "Create Account" : "Sign In"}
        </button>
      </form>
    </div>
  );
}
