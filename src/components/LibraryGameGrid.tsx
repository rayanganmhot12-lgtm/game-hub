"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckSquare, X, Download, XCircle } from "lucide-react";
import AnimatedGameGrid from "@/components/AnimatedGameGrid";
import { GameCardData } from "@/components/GameCard";
import { useToast } from "@/context/ToastContext";

export default function LibraryGameGrid({ games, className }: { games: GameCardData[]; className: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function applyBulk(installed: boolean) {
    setApplying(true);
    try {
      const res = await fetch("/api/games/bulk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selectedIds), installed }),
      });
      if (res.ok) {
        const count = selectedIds.size;
        showToast(`${count} game${count > 1 ? "s" : ""} updated.`, "success");
        exitSelectMode();
        router.refresh();
      } else {
        showToast("Couldn't update those games. Please try again.", "error");
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button onClick={() => (selectMode ? exitSelectMode() : setSelectMode(true))} className="btn-ghost">
          {selectMode ? <X size={15} /> : <CheckSquare size={15} />}
          {selectMode ? "Cancel" : "Select"}
        </button>
      </div>

      <AnimatedGameGrid
        games={games}
        className={className}
        selectable={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      <AnimatePresence>
        {selectMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="panel fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 px-4 py-3"
          >
            <span className="text-sm text-foreground">{selectedIds.size} selected</span>
            <button onClick={() => applyBulk(true)} disabled={applying} className="btn-primary !px-3 !py-1.5 !text-xs">
              <Download size={13} />
              Mark Installed
            </button>
            <button onClick={() => applyBulk(false)} disabled={applying} className="btn-ghost !px-3 !py-1.5 !text-xs">
              <XCircle size={13} />
              Mark Not Installed
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
