"use client";

import { Flame, Zap } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDarkRed = theme === "dark-red";

  return (
    <button
      onClick={toggleTheme}
      title={isDarkRed ? "Switch to Neon Orange theme" : "Switch to Dark Red theme"}
      className="btn-ghost"
    >
      {isDarkRed ? <Flame size={15} /> : <Zap size={15} />}
      <span className="hidden sm:inline">{isDarkRed ? "Dark Red" : "Neon Orange"}</span>
    </button>
  );
}
