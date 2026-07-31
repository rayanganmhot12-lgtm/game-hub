import { cookies } from "next/headers";
import { getIronSession, IronSession } from "iron-session";

export interface SavedAccount {
  userId: string;
  email: string;
  displayName: string;
}

export interface SessionData {
  userId?: string;
  // Other accounts logged into on this device — lets Switch Accounts swap
  // the active one instantly without a password. Never includes the
  // current `userId` itself. Capped at MAX_SAVED_ACCOUNTS entries, enforced
  // in the login route (not here, since this file has no request context).
  savedAccounts?: SavedAccount[];
}

export const MAX_SAVED_ACCOUNTS = 5;

const sessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "gamehub_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}
