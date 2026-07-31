"use client";

import { useState } from "react";
import { SmilePlus } from "lucide-react";

const EMOJI_SET = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function MessageReactions({
  reactions,
  myCode,
  onToggle,
  align = "start",
}: {
  reactions: Record<string, string[]> | undefined;
  myCode: string;
  onToggle: (emoji: string) => void;
  align?: "start" | "end";
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const entries = Object.entries(reactions ?? {}).filter(([, codes]) => codes.length > 0);

  return (
    <div className={`mt-1 flex flex-wrap items-center gap-1 ${align === "end" ? "justify-end" : "justify-start"}`}>
      {entries.map(([emoji, codes]) => {
        const mine = codes.includes(myCode);
        return (
          <button
            key={emoji}
            onClick={() => onToggle(emoji)}
            className={`flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
              mine
                ? "border-accent bg-accent/15 text-accent-bright"
                : "border-border bg-surface-2 text-muted hover:text-foreground"
            }`}
          >
            <span>{emoji}</span>
            <span>{codes.length}</span>
          </button>
        );
      })}

      <div className="relative">
        <button
          onClick={() => setPickerOpen((p) => !p)}
          className="rounded-full border border-border bg-surface-2 p-1 text-muted transition-colors hover:text-foreground"
          title="Add reaction"
        >
          <SmilePlus size={12} />
        </button>
        {pickerOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
            <div
              className={`absolute bottom-full z-20 mb-1 flex gap-1 rounded-lg border border-border bg-surface p-1.5 shadow-2xl ${
                align === "end" ? "right-0" : "left-0"
              }`}
            >
              {EMOJI_SET.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onToggle(emoji);
                    setPickerOpen(false);
                  }}
                  className="rounded p-1 text-base transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
