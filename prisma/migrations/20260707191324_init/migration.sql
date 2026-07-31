-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformAccountId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "profileUrl" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "platformGameId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "headerImageUrl" TEXT,
    "genres" TEXT,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "OwnedGame" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "playtimeMinutes2Wk" INTEGER NOT NULL DEFAULT 0,
    "lastPlayedAt" DATETIME,
    "installed" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OwnedGame_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OwnedGame_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_platform_platformAccountId_key" ON "Account"("platform", "platformAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Game_platform_platformGameId_key" ON "Game"("platform", "platformGameId");

-- CreateIndex
CREATE UNIQUE INDEX "OwnedGame_accountId_gameId_key" ON "OwnedGame"("accountId", "gameId");
