import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { getCurrentUser } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { trackFilePath } from "@/lib/uploads";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Only the admin account can remove playlist tracks." }, { status: 403 });
  }

  const { id } = await params;
  const track = await prisma.track.findUnique({ where: { id } });
  if (!track) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.track.delete({ where: { id } });
  await fs.unlink(trackFilePath(track.filename)).catch(() => {});

  return NextResponse.json({ ok: true });
}
