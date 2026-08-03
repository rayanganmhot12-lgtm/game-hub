"use client";

import { useRef, useState } from "react";
import { Upload, Play, Pause, Trash2, ListMusic, ChevronUp, ChevronDown, GripVertical } from "lucide-react";
import { useMusicPlayer } from "@/context/MusicPlayerContext";
import { useToast } from "@/context/ToastContext";
import { useTrackDurations } from "@/hooks/useTrackDurations";
import EmptyState from "@/components/EmptyState";
import Equalizer from "@/components/Equalizer";
import PageHeader from "@/components/PageHeader";
import type { Track } from "@/context/MusicPlayerContext";

function formatDuration(seconds: number | undefined) {
  if (seconds === undefined) return "—";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatTotal(seconds: number) {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

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
  const durations = useTrackDurations(tracks);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [reordering, setReordering] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // A running time is only worth stating once every track has reported one —
  // a total that silently omits the tracks still being probed is a wrong
  // number, not a partial one.
  const knownDurations = tracks.map((t) => durations[t.id]).filter((d): d is number => d !== undefined);
  const totalLabel =
    tracks.length > 0 && knownDurations.length === tracks.length
      ? formatTotal(knownDurations.reduce((sum, d) => sum + d, 0))
      : null;

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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Playlist"
        subtitle={
          isAdmin
            ? "Tracks you add here play for everyone using Game Hub."
            : "The background playlist for Game Hub. Sit back and listen."
        }
        action={
          tracks.length > 0 ? (
            // What the page is a collection of, stated where the page is
            // named. Previously you had to count the rows.
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface-2/60 px-3.5 py-1.5 text-xs">
              <ListMusic size={13} className="text-accent-bright" />
              <span className="font-medium text-foreground">
                {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
              </span>
              {totalLabel && (
                <>
                  <span className="text-border">·</span>
                  <span className="text-muted">{totalLabel}</span>
                </>
              )}
            </div>
          ) : undefined
        }
      />

      {isAdmin && (
        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-surface/20 p-6 text-center transition-colors hover:border-accent/50 hover:bg-accent/5">
          <div className="icon-badge h-11 w-11">
            <Upload size={20} />
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

      {tracks.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={ListMusic} title="No tracks yet">
            {isAdmin ? "Add your first one above." : undefined}
          </EmptyState>
        </div>
      ) : (
        // One surface holding every row. As individually bordered cards, a
        // dozen tracks read as a dozen unrelated objects rather than as one
        // ordered list.
        <div className="panel mt-6 p-2">
          {tracks.map((track, index) => {
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
                className={`group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors ${
                  isCurrent ? "bg-accent/10 ring-1 ring-accent/25" : "hover:bg-surface-2/70"
                } ${isDragging ? "opacity-40" : ""} ${isDragTarget ? "bg-accent/15 ring-1 ring-accent/45" : ""}`}
              >
                {isAdmin && (
                  <span
                    className="shrink-0 cursor-grab text-muted opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing"
                    title="Drag to reorder"
                  >
                    <GripVertical size={14} />
                  </span>
                )}

                {/* Position, playing state and the play control share one slot.
                    A permanent accent circle on every row made all of them
                    shout at the same volume; hover is when a row needs to
                    offer a control, and the rest of the time the number is the
                    more useful thing to show. */}
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                  <span
                    className={`flex h-full items-center justify-center text-xs tabular-nums transition-opacity group-hover:opacity-0 ${
                      isCurrent ? "text-accent-bright" : "text-muted"
                    }`}
                  >
                    {isCurrent && isPlaying ? <Equalizer className="h-3.5" /> : index + 1}
                  </span>
                  <button
                    onClick={() => (isCurrent ? togglePlay() : playTrackAt(index))}
                    title={isCurrent && isPlaying ? "Pause" : "Play"}
                    className="absolute inset-0 flex items-center justify-center rounded-md text-foreground opacity-0 transition-opacity duration-100 hover:text-accent-bright group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    {isCurrent && isPlaying ? (
                      <Pause size={15} fill="currentColor" />
                    ) : (
                      <Play size={15} fill="currentColor" />
                    )}
                  </button>
                </div>

                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    isCurrent ? "font-medium text-accent-bright" : "text-foreground"
                  }`}
                >
                  {track.title}
                </span>

                <span className="w-11 shrink-0 text-right text-xs tabular-nums text-muted">
                  {formatDuration(durations[track.id])}
                </span>

                {isAdmin && (
                  // Held open rather than hidden, so revealing the controls
                  // doesn't shove the durations column sideways.
                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <div className="flex flex-col">
                      <button
                        onClick={() => moveTrack(index, -1)}
                        disabled={index === 0 || reordering}
                        title="Move up"
                        className="rounded p-0.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90 disabled:opacity-30"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        onClick={() => moveTrack(index, 1)}
                        disabled={index === tracks.length - 1 || reordering}
                        title="Move down"
                        className="rounded p-0.5 text-muted transition-transform duration-100 hover:text-foreground active:scale-90 disabled:opacity-30"
                      >
                        <ChevronDown size={13} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeTrack(track.id)}
                      title="Remove track"
                      className="rounded-md p-1.5 text-muted transition-transform duration-100 hover:text-red-400 active:scale-90"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
