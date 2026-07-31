"use client";

import { useState } from "react";
import { Bookmark, Tag as TagIcon } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function TagsAndBacklog({
  id,
  initialTags,
  initialBacklog,
}: {
  id: string;
  initialTags: string[];
  initialBacklog: boolean;
}) {
  const { showToast } = useToast();
  const [tagsInput, setTagsInput] = useState(initialTags.join(", "));
  const [backlog, setBacklog] = useState(initialBacklog);

  async function patch(body: Record<string, unknown>) {
    await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  async function toggleBacklog() {
    const next = !backlog;
    setBacklog(next);
    await patch({ backlog: next });
  }

  async function handleTagsBlur() {
    await patch({ tags: tagsInput });
    showToast("Tags saved.", "success");
  }

  return (
    <div className="panel p-5">
      <h2 className="mb-3 text-sm font-semibold text-foreground">Tags &amp; Backlog</h2>

      <button
        onClick={toggleBacklog}
        className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
          backlog
            ? "border-accent/40 bg-accent/10 text-accent-bright shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.15)]"
            : "border-border text-muted hover:border-accent/40 hover:text-foreground"
        }`}
      >
        <Bookmark size={16} fill={backlog ? "currentColor" : "none"} />
        {backlog ? "In Backlog" : "Add to Backlog"}
      </button>

      <div className="flex items-center gap-2">
        <TagIcon size={14} className="shrink-0 text-muted" />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          onBlur={handleTagsBlur}
          placeholder="co-op, chill, story…"
          className="input-field w-full"
        />
      </div>
      <p className="mt-1 text-xs text-muted">Comma-separated, up to 10 tags.</p>
    </div>
  );
}
