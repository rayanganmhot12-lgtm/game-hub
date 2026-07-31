"use client";

import { motion } from "framer-motion";
import GameCard, { GameCardData } from "@/components/GameCard";

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" as const } },
};

export default function AnimatedGameGrid({
  games,
  className,
  selectable,
  selectedIds,
  onToggleSelect,
}: {
  games: GameCardData[];
  className: string;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}) {
  return (
    <motion.div
      key={games.map((g) => g.id).join(",")}
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {games.map((game) => (
        <motion.div key={game.id} variants={itemVariants}>
          <GameCard
            game={game}
            selectable={selectable}
            selected={selectedIds?.has(game.id)}
            onToggleSelect={onToggleSelect}
          />
        </motion.div>
      ))}
    </motion.div>
  );
}
