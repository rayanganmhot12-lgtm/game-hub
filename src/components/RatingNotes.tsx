"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function RatingNotes({
  id,
  initialRating,
  initialNotes,
}: {
  id: string;
  initialRating: number | null;
  initialNotes: string | null;
}) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [savingNotes, setSavingNotes] = useState(false);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function handleRate(value: number) {
    const next = rating === value ? null : value;
    setRating(next);
    await patch({ rating: next });
  }

  async function handleNotesBlur() {
    setSavingNotes(true);
    try {
      await patch({ notes });
      showToast("Notes saved.", "success");
    } finally {
      setSavingNotes(false);
    }
  }

  return (
    <div className="panel p-5">
      <h2 className="section-title mb-3">Your Rating & Notes</h2>

      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = (hoverRating ?? rating ?? 0) >= value;
          return (
            <button
              key={value}
              onClick={() => handleRate(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(null)}
              title={`Rate ${value} star${value > 1 ? "s" : ""}`}
              className="p-0.5 transition-transform duration-100 active:scale-90"
            >
              <Star
                size={22}
                className={filled ? "text-accent-bright" : "text-muted"}
                fill={filled ? "currentColor" : "none"}
              />
            </button>
          );
        })}
        {rating && (
          <span className="ml-2 text-xs text-muted">{rating} / 5</span>
        )}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onBlur={handleNotesBlur}
        placeholder="Write a personal note about this game…"
        maxLength={2000}
        rows={3}
        className="input-field mt-4 w-full resize-none"
      />
      {savingNotes && <p className="mt-1 text-xs text-muted">Saving…</p>}
    </div>
  );
}
