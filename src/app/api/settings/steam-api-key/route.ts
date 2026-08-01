import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { readInstallSettings, writeInstallSettings } from "@/lib/installSettings";

// Not admin-gated: this is a per-install convenience setting, not a
// moderation/broadcast privilege — any signed-in user on this install
// should be able to set it for themselves.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const settings = readInstallSettings();
  if (!settings.steamApiKey) {
    return NextResponse.json({ configured: false });
  }
  return NextResponse.json({ configured: true, lastFour: settings.steamApiKey.slice(-4) });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
  if (!apiKey) {
    return NextResponse.json({ error: "Enter your Steam API key." }, { status: 400 });
  }

  try {
    writeInstallSettings({ steamApiKey: apiKey });
  } catch {
    return NextResponse.json({ error: "Couldn't save the key. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, lastFour: apiKey.slice(-4) });
}
