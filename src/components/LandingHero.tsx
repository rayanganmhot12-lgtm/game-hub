"use client";

import { motion } from "framer-motion";
import { Gamepad2, Library, BarChart3, Search } from "lucide-react";
import AuthForm from "@/components/AuthForm";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

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
        <motion.div
          animate={{ rotate: [0, -6, 0, 6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          className="icon-badge h-14 w-14"
        >
          <Gamepad2 className="glow-accent-text" size={30} />
        </motion.div>
        <h1 className="text-4xl font-extrabold tracking-tight text-foreground">
          Game<span className="text-gradient">Hub</span>
        </h1>
      </motion.div>

      <motion.p variants={item} className="relative mt-4 max-w-md text-center text-muted">
        Your entire game library, unified. Sign in, then connect your platforms and see every
        game you own in one glowing dashboard.
      </motion.p>

      <motion.div variants={item} className="relative mt-10">
        <AuthForm />
      </motion.div>

      <motion.div
        variants={item}
        className="relative mt-16 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <FeatureCard icon={Library} title="Unified Library" text="Every owned game, every platform, one grid." />
        <FeatureCard icon={Search} title="Search & Filter" text="Find games by platform, playtime, or install state." />
        <FeatureCard icon={BarChart3} title="Stats Dashboard" text="Total playtime, breakdowns, recently played." />
      </motion.div>
    </motion.div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Library;
  title: string;
  text: string;
}) {
  return (
    <div className="panel panel-hover p-5 text-center">
      <div className="icon-badge mx-auto h-11 w-11">
        <Icon size={22} />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs text-muted">{text}</p>
    </div>
  );
}
