"use client";

import { Megaphone, X } from "lucide-react";

// The appearance of an announcement, and nothing else — no timers, no queue, no
// Firebase. Both the live banner and the composer's preview render this, so the
// preview cannot drift from what actually arrives.
export default function AnnouncementCard({
  message,
  fromDisplayName,
  queueLabel,
  progress,
  onDismiss,
  onPointerEnter,
  onPointerLeave,
}: {
  message: string;
  fromDisplayName: string;
  /** e.g. "1 of 3", shown only while other announcements are waiting. */
  queueLabel?: string;
  /** 0 to 1 of the auto-dismiss timer remaining. Omitted in the preview. */
  progress?: number;
  onDismiss?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
}) {
  return (
    <div
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      className="relative overflow-hidden rounded-b-2xl border border-t-0 border-accent/40 bg-surface/95 px-6 py-5 shadow-2xl backdrop-blur-xl"
    >
      <div className="flex items-start gap-4">
        <span className="icon-badge h-14 w-14 shrink-0">
          <Megaphone size={26} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-accent-bright">
              Announcement from {fromDisplayName}
            </p>
            {queueLabel && (
              <span className="shrink-0 rounded-full border border-border/70 bg-surface-2/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted">
                {queueLabel}
              </span>
            )}
          </div>
          {/* The whole message. It used to be truncated to one line, which cut
              off the only thing an announcement exists to deliver. Capped in
              height so a very long one cannot swallow the screen. */}
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words text-base leading-relaxed text-foreground">
            {message}
          </p>
        </div>

        {onDismiss && (
          <button
            onClick={onDismiss}
            title="Dismiss"
            className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* A draining bar rather than a number in a circle. The duration now
          varies with the length of the message, and a bar reads at a glance
          where a ticking number mostly applies pressure. */}
      {progress !== undefined && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-border/40">
          <div
            className="h-full bg-gradient-to-r from-accent to-accent-bright"
            style={{ width: `${Math.max(0, Math.min(1, progress)) * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
