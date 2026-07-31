"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSound } from "@/context/SoundContext";

const SNOWFLAKE_COUNT = 45;
const PARTICLE_COUNT = 32;
const SPARKLE_COUNT = 10;
const TOTAL_DURATION_MS = 7000;
const ROCKET_LAUNCH_AT_MS = 2200;
const ROCKET_FLIGHT_MS = 1100;
const BURST_AT_MS = ROCKET_LAUNCH_AT_MS + ROCKET_FLIGHT_MS; // 3300
const TEXT_AT_MS = BURST_AT_MS + 200; // 3500
const FADEOUT_AT_MS = TOTAL_DURATION_MS - 700; // 6300

type Phase = "snow" | "rocket" | "burst" | "text" | "fadeout";

interface Snowflake {
  id: number;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

interface Sparkle {
  id: number;
  top: number;
  left: number;
  delay: number;
}

const PARTICLE_COLORS = ["#ff8a00", "#ffd23f", "#ffffff", "#ff5e5e", "#ff3df0"];

// Purchase celebration for Game Hub Plus, matched to playPlusFanfare()'s
// timing in sound.ts: snow falls, a rocket launches from the bottom and
// flies up-screen, explodes center-screen (screen shake + layered shockwave
// rings + gravity-affected firework sparks) revealing "PLUS" with twinkling
// sparkles, then the whole scene fades out smoothly. ~7s total.
export default function PlusCelebration({ onDone }: { onDone: () => void }) {
  const { playPlus } = useSound();
  const [phase, setPhase] = useState<Phase>("snow");
  const [flakes] = useState<Snowflake[]>(() =>
    Array.from({ length: SNOWFLAKE_COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 2.5 + Math.random() * 2,
      size: 4 + Math.random() * 6,
    }))
  );
  const [particles] = useState<Particle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      angle: (360 / PARTICLE_COUNT) * i + Math.random() * 10,
      distance: 110 + Math.random() * 180,
      size: 4 + Math.random() * 7,
      color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
    }))
  );
  const [sparkles] = useState<Sparkle[]>(() =>
    Array.from({ length: SPARKLE_COUNT }, (_, i) => ({
      id: i,
      top: 50 + (Math.random() - 0.5) * 40,
      left: 50 + (Math.random() - 0.5) * 60,
      delay: Math.random() * 1.6,
    }))
  );

  useEffect(() => {
    playPlus();
    const timers = [
      setTimeout(() => setPhase("rocket"), ROCKET_LAUNCH_AT_MS),
      setTimeout(() => setPhase("burst"), BURST_AT_MS),
      setTimeout(() => setPhase("text"), TEXT_AT_MS),
      setTimeout(() => setPhase("fadeout"), FADEOUT_AT_MS),
      setTimeout(() => onDone(), TOTAL_DURATION_MS),
    ];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showRocket = phase === "rocket";
  const showBurst = phase === "burst" || phase === "text" || phase === "fadeout";
  const showText = phase === "text" || phase === "fadeout";
  const isShaking = phase === "burst";

  return (
    <motion.div
      animate={{ opacity: phase === "fadeout" ? 0 : 1 }}
      transition={{ duration: 0.7, ease: "easeIn" }}
      className={`fixed inset-0 z-[200] overflow-hidden bg-black/60 ${isShaking ? "plus-shake" : ""}`}
      onClick={onDone}
    >
      {flakes.map((f) => (
        <span
          key={f.id}
          className="absolute top-[-20px] rounded-full bg-white/80"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            animation: `plus-snow-fall ${f.duration}s linear ${f.delay}s infinite`,
          }}
        />
      ))}

      {showRocket && (
        <motion.div
          initial={{ top: "105%", opacity: 1 }}
          animate={{ top: "50%", opacity: 1 }}
          transition={{ duration: ROCKET_FLIGHT_MS / 1000, ease: "easeIn" }}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl"
        >
          <motion.div
            animate={{ scaleY: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 0.2, repeat: Infinity }}
            className="absolute left-1/2 top-full -translate-x-1/2 h-8 w-3 rounded-full bg-gradient-to-b from-orange-400 via-amber-300 to-transparent blur-[2px]"
          />
          🚀
        </motion.div>
      )}

      {showBurst && (
        <>
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 9, opacity: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-accent-bright to-accent"
          />
          <motion.div
            initial={{ scale: 0, opacity: 0.9 }}
            animate={{ scale: 6, opacity: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: "easeOut" }}
            className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent-bright/70"
          />
          {particles.map((p) => {
            const radians = (p.angle * Math.PI) / 180;
            const dx = Math.cos(radians) * p.distance;
            const dy = Math.sin(radians) * p.distance;
            return (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                animate={{ x: [0, dx, dx * 1.12], y: [0, dy, dy + 140], opacity: [1, 1, 0], scale: [1, 1, 0.3] }}
                transition={{ duration: 1.7, times: [0, 0.3, 1], ease: "easeOut" }}
                className="absolute left-1/2 top-1/2 rounded-full"
                style={{ width: p.size, height: p.size, backgroundColor: p.color }}
              />
            );
          })}
        </>
      )}

      {showText && (
        <>
          <motion.div
            initial={{ scale: 0.3, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-7xl font-black tracking-tight text-gradient glow-accent-text"
          >
            PLUS
          </motion.div>
          {sparkles.map((s) => (
            <motion.span
              key={s.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 0], scale: [0, 1, 0] }}
              transition={{ duration: 1.1, delay: s.delay, repeat: Infinity, repeatDelay: 0.6 }}
              className="absolute text-accent-bright"
              style={{ top: `${s.top}%`, left: `${s.left}%`, fontSize: 14 }}
            >
              ✦
            </motion.span>
          ))}
        </>
      )}
    </motion.div>
  );
}
