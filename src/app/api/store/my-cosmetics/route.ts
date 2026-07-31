import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

// A small standalone lookup so client components deep in the tree (e.g. the
// "pin a favorite" picker on your own profile card) can grab just this one
// field without threading it down as a prop through every parent.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({
    unlockedCosmetics: user.unlockedCosmetics ? (JSON.parse(user.unlockedCosmetics) as string[]) : [],
  });
}
