import { NextResponse } from "next/server";
import { getCurrentUser, getDisplayName } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function GET() {
  const user = await getCurrentUser();
  const session = await getSession();
  const savedAccounts = session.savedAccounts ?? [];

  if (!user) {
    return NextResponse.json({ user: null, savedAccounts: [] });
  }

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      displayName: getDisplayName(user),
      accounts: user.accounts.map((a) => ({
        id: a.id,
        platform: a.platform,
        displayName: a.displayName,
        avatarUrl: a.avatarUrl,
        lastSyncedAt: a.lastSyncedAt,
      })),
    },
    savedAccounts,
  });
}
