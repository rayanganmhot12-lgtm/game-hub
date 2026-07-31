# Moderation: Send Message + Remove Timeout — Design Spec

Date: 2026-08-01

## Goal

Add two small controls to the existing Moderation page (`src/components/ModerationPanel.tsx`): a way to send a one-off friendly message to just the selected Target (not the full-screen "Warn", not a broadcast to everyone), and a way to lift an active timeout immediately instead of waiting it out.

## Send Message

Reuses the existing `sendAnnouncement` mechanism (`src/lib/announcementRealtime.ts`) already used by "Announce to Everyone" — same friendly banner UI on the recipient's side (`AnnouncementBanner.tsx`), same Firebase path shape (`announcements/{code}`). The only difference: instead of looping over every friend, it's called once for the single Target friend code already entered in the existing "Target" panel.

New panel, placed directly after the existing "Warn" panel (same layout: text input + button):

- Text input, placeholder "Message shown as a friendly notification…"
- "Send Message" button, disabled when `busy` or Firebase isn't configured (matches every other action button's disabled logic)
- On click: validate a target code is entered (via the existing `getTargetCode()` helper) and the message isn't empty, call `sendAnnouncement(code, message, myDisplayName)`, log the action via the existing `logAction("message", message.trim())` helper, show a success/error toast, clear the input on success.

## Remove Timeout

Adds a second button inside the existing "Timeout" panel, next to "Apply Timeout" — mirrors the Mute/Unmute and Ban/Unban button pairs already in the panel (`btn-primary` + `btn-ghost` side by side).

- "Remove Timeout" button (`btn-ghost`, matches Unmute/Unban styling)
- On click: validate a target code is entered, call `setModerationState(code, { timeoutUntil: null })` (same function already used to set a timeout, just clearing it), log the action via `logAction("remove timeout")`, show a toast, matching the existing `handleTimeout` function's structure.

## Out of scope

- No new Firebase path or schema change — both reuse existing mechanisms exactly as they already work today.
- No change to how the Target panel, Warn panel, or existing Mute/Ban/Timeout buttons behave.
