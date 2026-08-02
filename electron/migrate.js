// Brings an existing install's database up to the schema the shipped code
// expects, at every launch.
//
// Why this exists: `prisma migrate deploy` runs exactly once, at package
// time (scripts/prepare-empty-db.js), and its output is the fully-migrated
// dist-empty.db that seeds a FRESH install. Nothing was ever bringing an
// ALREADY-INSTALLED database forward. So every schema change shipped after
// someone installed left their dev.db permanently behind: 0.1.7 added
// User.nameEffect, getCurrentUser() selects it, and on any older database
// that SELECT throws — meaning every page that resolves the current user
// returns 500. That is the "This page couldn't load" screen, and it hit
// every existing user while fresh installs looked perfectly fine.
//
// The Prisma CLI isn't bundled in the packaged app, so this reimplements the
// small part of `migrate deploy` that matters: read _prisma_migrations, find
// the migration folders that aren't in it, and apply each one's SQL inside a
// transaction, recording it the same way Prisma does.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// Prisma's own _prisma_migrations DDL, needed only for the theoretical case
// of a database that never went through the CLI. Every real install is
// seeded from dist-empty.db, which already has it.
const MIGRATIONS_TABLE_DDL = `
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    TEXT PRIMARY KEY NOT NULL,
    "checksum"              TEXT NOT NULL,
    "finished_at"           DATETIME,
    "migration_name"        TEXT NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        DATETIME,
    "started_at"            DATETIME NOT NULL DEFAULT current_timestamp,
    "applied_steps_count"   INTEGER UNSIGNED NOT NULL DEFAULT 0
)`;

function listMigrations(migrationsDir) {
  return fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationsDir, entry.name, "migration.sql")))
    // Prisma names migration folders <timestamp>_<label>, so lexical order is
    // chronological order — which is the only order they may be applied in.
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((entry) => entry.name);
}

/**
 * Applies every migration in `migrationsDir` that `dbPath` hasn't recorded yet.
 * Returns the list of migration names applied (empty when already current).
 * Throws on the first failure, leaving that migration rolled back.
 */
function applyPendingMigrations({ dbPath, migrationsDir, betterSqlite3Path }) {
  if (!fs.existsSync(dbPath) || !fs.existsSync(migrationsDir)) return [];

  const Database = require(betterSqlite3Path);
  let db = new Database(dbPath);

  try {
    db.exec(MIGRATIONS_TABLE_DDL);
    const applied = new Set(
      db
        .prepare("SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")
        .all()
        .map((row) => row.migration_name)
    );
    const pending = listMigrations(migrationsDir).filter((name) => !applied.has(name));
    if (pending.length === 0) return [];

    // Fold the write-ahead log back into the main file so the backup taken
    // below is a complete database on its own, not one missing its most
    // recent commits.
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
    fs.copyFileSync(dbPath, `${dbPath}.pre-migration-backup`);
    db = new Database(dbPath);

    for (const name of pending) {
      const sql = fs.readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8");
      db.exec("BEGIN");
      try {
        // Prisma's table-rebuild migrations open with `PRAGMA
        // defer_foreign_keys=ON`, which — unlike `PRAGMA foreign_keys=OFF`,
        // a silent no-op mid-transaction — does take effect here and holds
        // constraint checks until COMMIT. So these run correctly wrapped.
        db.exec(sql);
        db.prepare(
          `INSERT INTO _prisma_migrations
             (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, 1)`
        ).run(
          crypto.randomUUID(),
          crypto.createHash("sha256").update(sql).digest("hex"),
          new Date().toISOString(),
          name,
          new Date().toISOString()
        );
        db.exec("COMMIT");
        console.log(`migrate: applied ${name}`);
      } catch (err) {
        db.exec("ROLLBACK");
        throw new Error(`Migration "${name}" failed: ${err.message}`);
      }
    }

    return pending;
  } finally {
    try {
      db.close();
    } catch {
      // Already closed by the checkpoint/reopen dance, or by a failure — the
      // process is about to move on either way.
    }
  }
}

module.exports = { applyPendingMigrations };
