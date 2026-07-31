-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OwnedGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "playtimeMinutes2Wk" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "installed" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "notes" TEXT,
    "unlockedAchievements" TEXT,
    "tags" TEXT,
    "backlog" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OwnedGame_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OwnedGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OwnedGame" ("accountId", "gameId", "id", "installed", "lastPlayedAt", "notes", "playtimeMinutes", "playtimeMinutes2Wk", "rating", "unlockedAchievements") SELECT "accountId", "gameId", "id", "installed", "lastPlayedAt", "notes", "playtimeMinutes", "playtimeMinutes2Wk", "rating", "unlockedAchievements" FROM "OwnedGame";
DROP TABLE "OwnedGame";
ALTER TABLE "new_OwnedGame" RENAME TO "OwnedGame";
CREATE UNIQUE INDEX "OwnedGame_accountId_gameId_key" ON "OwnedGame"("accountId", "gameId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
