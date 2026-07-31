"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      <div className="relative mb-4 flex rounded-lg border border-border p-1 text-sm">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            data-testid={m === "login" ? "auth-tab-login" : "auth-tab-register"}
            onClick={() => setMode(m)}
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

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          data-testid="auth-email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field w-full"
        />
        <input
          type="password"
          required
          minLength={8}
          data-testid="auth-password"
          placeholder="Password (min. 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field w-full"
        />

        {error && <p className="text-sm text-red-300">{error}</p>}

        <button type="submit" data-testid="auth-submit" disabled={loading} className="btn-primary mt-1">
          {loading && <Loader2 className="animate-spin" size={16} />}
          {mode === "login" ? "Sign In" : "Create Account"}
        </button>
      </form>
    </div>
  );
}
