"use client";

import { motion } from "framer-motion";
import { Gamepad2 } from "lucide-react";
import AuthForm from "@/components/AuthForm";
import { version as appVersion } from "../../package.json";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

// A sign-in screen, not a landing page. Everyone who reaches it has already
// downloaded and installed the app, so the three feature cards that used to sit
// below restated the sentence above them to an audience that needed no
// convincing. What is left has one job.
export default function LandingHero() {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="relative flex w-full flex-col items-center"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 h-64 w-64 rounded-full bg-accent/30 blur-[90px]"
      />

      <motion.div variants={item} className="relative flex items-center gap-3">
        {/* The rotation used to run forever. A permanent animation on a screen
            you sit still and type into is noise; it plays once on arrival. */}
        <motion.div
          initial={{ rotate: -8 }}
          animate={{ rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className="icon-badge h-14 w-14"
        >
          <Gamepad2 className="glow-accent-text" size={30} />
        </motion.div>
        {/* The app's own wordmark treatment. This screen used to draw "Game" in
            plain foreground and gradient only "Hub", at a hand-rolled size — a
            third variant of the identity, on the largest type a new user sees. */}
        <h1 className="page-title">GameHub</h1>
      </motion.div>

      <motion.p variants={item} className="relative mt-3 max-w-sm text-center text-sm text-muted">
        Your entire game library, unified across every platform.
      </motion.p>

      <motion.div variants={item} className="relative mt-8">
        <AuthForm />
      </motion.div>

      {/* Which build is in front of you, without opening anything. */}
      <motion.div variants={item} className="relative mt-5 flex items-center gap-2 text-[11px]">
        <span className="rounded-full border border-accent/40 px-1.5 py-0.5 font-semibold uppercase tracking-wide text-accent-bright">
          Beta
        </span>
        <span className="text-muted">v{appVersion}</span>
      </motion.div>
    </motion.div>
  );
}
