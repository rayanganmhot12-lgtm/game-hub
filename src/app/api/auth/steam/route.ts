import { NextResponse } from "next/server";
import { getSteamLoginUrl } from "@/lib/steam";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();
  if (!session.userId) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    return NextResponse.redirect(`${baseUrl}/?error=must_sign_in`);
  }
  return NextResponse.redirect(getSteamLoginUrl());
}
