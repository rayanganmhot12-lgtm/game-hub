// Generates a fresh, empty (but fully migrated) SQLite database for
// packaging — friends must never receive the developer's real dev.db.
// Regenerated on every `npm run dist` rather than checked into the repo, so
// it can never drift from the current Prisma schema.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const outputPath = path.join(root, "prisma", "dist-empty.db");

if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath);
}

execFileSync("npx", ["prisma", "migrate", "deploy"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `file:${outputPath}` },
  shell: true,
});

if (!fs.existsSync(outputPath)) {
  console.error(`Expected a fresh database at ${outputPath} but it wasn't created.`);
  process.exit(1);
}

console.log(`Generated fresh empty database at ${outputPath} for packaging.`);
