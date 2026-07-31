-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "points" INTEGER NOT NULL DEFAULT 100,
    "lifetimePointsEarned" INTEGER NOT NULL DEFAULT 0,
    "unlockedCosmetics" TEXT,
    "equippedFrame" TEXT,
    "equippedBadge" TEXT
);
INSERT INTO "new_User" ("createdAt", "email", "equippedBadge", "equippedFrame", "id", "passwordHash", "points", "unlockedCosmetics") SELECT "createdAt", "email", "equippedBadge", "equippedFrame", "id", "passwordHash", "points", "unlockedCosmetics" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
