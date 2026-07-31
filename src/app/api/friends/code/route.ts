import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOrCreateFriendCode } from "@/lib/friendCodeServer";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const code = await getOrCreateFriendCode(user.id);
  return NextResponse.json({ code });
}
