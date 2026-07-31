import path from "node:path";
import fs from "node:fs/promises";

export const MUSIC_UPLOAD_DIR = path.join(process.cwd(), "uploads", "music");

export const ALLOWED_AUDIO_TYPES: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
  "audio/flac": "flac",
};

export const MAX_TRACK_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

export async function ensureMusicUploadDir() {
  await fs.mkdir(MUSIC_UPLOAD_DIR, { recursive: true });
}

export function trackFilePath(filename: string) {
  return path.join(MUSIC_UPLOAD_DIR, filename);
}
