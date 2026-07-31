"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { listenForWarnings, removeWarning, type WarningPayload } from "@/lib/moderationRealtime";
import { useSound } from "@/context/SoundContext";
import { logNotification } from "@/lib/notifications";

export default function WarningOverlay({ myCode }: { myCode: string }) {
  const [warning, setWarning] = useState<(WarningPayload & { id: string }) | null>(null);
  const { playWarning } = useSound();

  useEffect(() => {
    return listenForWarnings(myCode, (w) => {
      if (w) {
        playWarning();
        logNotification("warning", `Admin warning: ${w.message}`);
      }
      setWarning(w);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myCode]);

  function dismiss() {
    if (!warning) return;
    removeWarning(myCode, warning.id);
    setWarning(null);
  }

  return (
    <AnimatePresence>
      {warning && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="panel flex max-w-sm flex-col items-center p-8 text-center"
            style={{ borderColor: "rgba(239, 68, 68, 0.5)" }}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/15 text-red-400">
              <AlertTriangle size={28} />
            </div>
            <h2 className="text-lg font-bold text-foreground">Warning from an admin</h2>
            <p className="mt-2 text-sm text-muted">{warning.message}</p>
            <button onClick={dismiss} className="btn-primary mt-6 w-full">
              I understand
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
