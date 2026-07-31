// Pure, client-safe helpers — no server imports, so client components can
// import this without accidentally pulling Prisma/better-sqlite3 into the
// browser bundle. See friendCodeServer.ts for the DB-backed generator.

export function formatFriendCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeFriendCode(input: string): string {
  return input.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
