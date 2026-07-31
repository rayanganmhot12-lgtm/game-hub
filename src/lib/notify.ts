// The standard Notification API is automatically backed by real OS
// notifications when running inside Electron (no IPC needed) — in a plain
// browser tab it just no-ops unless the user has granted permission. Either
// way the in-app toast (called separately by the caller) is the reliable
// path; this is a best-effort bonus.
export function fireNativeNotification(title: string, body: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") return;

  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        new Notification(title, { body });
      }
    });
  }
}
