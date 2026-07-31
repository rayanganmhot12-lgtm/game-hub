"use client";

export function logNotification(type: string, message: string) {
  fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, message }),
  }).catch(() => {});
}
