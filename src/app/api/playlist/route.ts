import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { ensureMusicUploadDir, trackFilePath, ALLOWED_AUDIO_TYPES, MAX_TRACK_SIZE_BYTES } from "@/lib/uploads";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const tracks = await prisma.track.findMany({
    orderBy: { uploadedAt: "asc" },
  });

  return NextResponse.json({
    tracks: tracks.map((t) => ({ id: t.id, title: t.title, uploadedAt: t.uploadedAt, sizeBytes: t.sizeBytes })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Only the admin account can add playlist tracks." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const extension = ALLOWED_AUDIO_TYPES[file.type];
  if (!extension) {
    return NextResponse.json(
      { error: "Unsupported audio format. Use MP3, WAV, OGG, M4A, or FLAC." },
      { status: 400 }
    );
  }

  if (file.size > MAX_TRACK_SIZE_BYTES) {
    return NextResponse.json({ error: "File too large. Max 25MB per track." }, { status: 400 });
  }

  await ensureMusicUploadDir();

  const filename = `${randomUUID()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(trackFilePath(filename), buffer);

  const titleField = formData.get("title");
  const title =
    typeof titleField === "string" && titleField.trim()
      ? titleField.trim()
      : file.name.replace(/\.[^.]+$/, "");

  const track = await prisma.track.create({
    data: {
      title,
      filename,
      mimeType: file.type,
      sizeBytes: file.size,
    },
  });

  return NextResponse.json({
    track: { id: track.id, title: track.title, uploadedAt: track.uploadedAt, sizeBytes: track.sizeBytes },
  });
}
