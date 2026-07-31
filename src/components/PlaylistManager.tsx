"use client";

import { useRef, useState } from "react";
import { Upload, Play, Pause, Trash2, Music2, ListMusic, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { useMusicPlayer } from "@/context/MusicPlayerContext";
import { useToast } from "@/context/ToastContext";
import EmptyState from "@/components/EmptyState";
import type { Track } from "@/context/MusicPlayerContext";

function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/playlist");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ ok: true });
      } else {
        let error = `Failed to upload ${file.name}`;
        try {
          error = JSON.parse(xhr.responseText)?.error ?? error;
        } catch {
          // ignore parse failure, use default message
        }
        resolve({ ok: false, error });
      }
    };
    xhr.onerror = () => resolve({ ok: false, error: `Failed to upload ${file.name}` });
    xhr.send(formData);
  });
}

export default function PlaylistManager({ isAdmin }: { isAdmin: boolean }) {
  const { tracks, currentTrack, isPlaying, playTrackAt, togglePlay, removeTrack, refreshTracks } =
    useMusicPlayer();
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);

    let addedCount = 0;
    const fileList = Array.from(files);
    for (let i = 0; i < fileList.length; i++) {
      setProgress(0);
      const result = await uploadWithProgress(fileList[i], setProgress);
      if (!result.ok) {
        showToast(result.error ?? "Upload failed.", "error");
      } else {
        addedCount++;
      }
    }

    if (addedCount > 0) {
      showToast(addedCount === 1 ? "Track added." : `${addedCount} tracks added.`, "success");
    }

    await refreshTracks();
    setUploading(false);
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function reorderTo(newOrder: Track[]) {
    setReordering(true);
    try {
      await fetch("/api/playlist/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: newOrder.map((t) => t.id) }),
      });
      await refreshTracks();
    } finally {
      setReordering(false);
    }
  }

  async function moveTrack(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= tracks.length) return;
    const reordered = [...tracks];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    await reorderTo(reordered);
  }

  function handleDrop(dropIndex: number) {
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...tracks];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, moved);
    setDraggedIndex(null);
    setDragOverIndex(null);
    reorderTo(reordered);
  }

  return (
    <div className="mx-auto max-w-2xl pb-16">
      <h1 className="text-2xl font-bold text-foreground">Playlist</h1>
      <p className="mt-1 text-sm text-muted">
        {isAdmin
          ? "Tracks you add here play for everyone using Game Hub."
          : "The background playlist for Game Hub. Sit back and listen."}
      </p>

      {isAdmin && (
        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-surface/20 p-8 text-center transition-colors hover:border-accent/50 hover:bg-accent/5">
          <div className="icon-badge h-12 w-12">
            <Upload size={22} />
          </div>
          <span className="text-sm text-foreground">
            {uploading ? `Uploading… ${progress}%` : "Click to add MP3, WAV, OGG, M4A, or FLAC files"}
          </span>
          {uploading && (
            <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full bg-accent transition-[width] duration-150"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
          <span className="text-xs text-muted">Max 25MB per track</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/flac"
            multiple
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}

      <div className="mt-6 flex flex-col gap-2">
        {tracks.length === 0 ? (
          <EmptyState icon={ListMusic} title="No tracks yet">
            {isAdmin ? "Add your first one above." : undefined}
          </EmptyState>
        ) : (
          tracks.map((track, index) => {
            const isCurrent = currentTrack?.id === track.id;
            const isDragging = draggedIndex === index;
            const isDragTarget = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index;
            return (
              <div
                key={track.id}
                draggable={isAdmin}
                onDragStart={() => setDraggedIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverIndex !== index) setDragOverIndex(index);
                }}
                onDragEnd={() => {
                  setDraggedIndex(null);
                  setDragOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(index);
                }}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
                  isCurrent
                    ? "border-accent/40 bg-accent/5 shadow-[0_0_0_1px_rgba(var(--accent-rgb),0.15)]"
                    : "border-border bg-surface"
                } ${isDragging ? "opacity-40" : ""} ${isDragTarget ? "border-accent/70 bg-accent/10" : ""}`}
              >
                {isAdmin && (
                  <span
                    className="shrink-0 cursor-grab text-muted active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical size={16} />
                  </span>
                )}
                <button
                  onClick={() => (isCurrent ? togglePlay() : playTrackAt(index))}
                  title={isCurrent && isPlaying ? "Pause" : "Play"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent-bright to-accent text-black transition-transform duration-100 hover:brightness-105 active:scale-90"
                >
                  {isCurrent && isPlaying ? (
                    <Pause size={14} fill="currentColor" />
                  ) : (
                    <Play size={14} fill="currentColor" />
                  )}
                </button>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Music2 size={14} className="shrink-0 text-muted" />
                  <span className="truncate text-sm text-foreground">{track.title}</span>
                </div>
                {isAdmin && (
                  <>
                    <div className="flex shrink-0 flex-col">
                      <button
                        onClick={() => moveTrack(index, -1)}
                        disabled={index === 0 || reordering}
                        title="Move up"
                        className="rounded p-0.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90 disabled:opacity-30"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => moveTrack(index, 1)}
                        disabled={index === tracks.length - 1 || reordering}
                        title="Move down"
                        className="rounded p-0.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90 disabled:opacity-30"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeTrack(track.id)}
                      title="Remove track"
                      className="shrink-0 rounded-md p-2 text-muted transition-transform duration-100 hover:text-red-400 active:scale-90"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
