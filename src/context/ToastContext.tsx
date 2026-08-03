"use client";

import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const COLORS: Record<ToastVariant, string> = {
  success: "border-accent-dim bg-accent/10 text-accent-bright",
  error: "border-red-500/40 bg-red-500/10 text-red-300",
  info: "border-border bg-surface text-foreground",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  function dismiss(id: number) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toasts stack above the music dock when there is one, and drop to the
          corner when there isn't. The offset used to be a hard-coded 4rem
          guarding empty space; the dock now actually occupies the bottom edge.
          See MusicPlayerBar, which publishes --music-bar-height. */}
      <div className="pointer-events-none fixed bottom-[calc(1rem+var(--music-bar-height,0px))] right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.variant];
            return (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40 }}
                transition={{ duration: 0.2 }}
                className={`pointer-events-auto flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-lg ${COLORS[toast.variant]}`}
              >
                <Icon size={16} className="shrink-0" />
                <span className="max-w-xs">{toast.message}</span>
                <button
                  onClick={() => dismiss(toast.id)}
                  className="ml-1 shrink-0 opacity-70 hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
