// Sets a new password on a local Game Hub account.
//
// Passwords are stored as one-way bcrypt hashes, so a forgotten one can't be
// recovered — only replaced. This script prompts for the new password on the
// terminal with the echo suppressed, so it never appears in the shell history,
// in a command line, or anywhere it could be read back later.
//
//   node scripts/reset-local-password.js <email> [--installed | --project]
//
//   --installed  the packaged app's database in %APPDATA%\game-hub (default)
//   --project    this checkout's own dev.db, used by `npm run dev`
//
// Close Game Hub before running: SQLite refuses concurrent writers, and the
// running server holds the file open.
const path = require("path");
const fs = require("fs");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");

// Matches SALT_ROUNDS in src/lib/password.ts — a different cost here would
// still verify correctly, but keeping them equal avoids a surprise later.
const SALT_ROUNDS = 10;

const DATABASES = {
  installed: path.join(process.env.APPDATA || "", "game-hub", "dev.db"),
  // DATABASE_URL is "file:./dev.db", which the adapter resolves against the
  // project root, not prisma/ — there is an unrelated empty prisma/dev.db that
  // looks like the real one and isn't.
  project: path.join(__dirname, "..", "dev.db"),
};

// Control characters raw mode delivers verbatim, spelled out rather than
// embedded literally so they survive editing and stay readable in a diff.
const ENTER = ["\r", "\n", "\u0004"]; // Return, newline, Ctrl+D
const BACKSPACE = ["\u007f", "\b"];
const CTRL_C = "\u0003";

// Non-TTY input needs a queue, not a listener per prompt. readline emits
// every buffered line as soon as it has them, so a `once("line")` attached
// for the second question is registered after that line has already been
// emitted and dropped — the script hangs with no error. This path exists so
// the whole flow can be exercised from a pipe; interactive use takes the raw
// branch below.
let piped = null;

function readPipedLine() {
  if (!piped) {
    piped = { queue: [], waiting: null, ended: false };
    const rl = readline.createInterface({ input: process.stdin });
    piped.rl = rl;
    const deliver = (line) => {
      if (piped.waiting) {
        const resolve = piped.waiting;
        piped.waiting = null;
        resolve(line);
      } else {
        piped.queue.push(line);
      }
    };
    rl.on("line", deliver);
    rl.on("close", () => {
      piped.ended = true;
      if (piped.waiting) deliver("");
    });
  }
  return new Promise((resolve) => {
    if (piped.queue.length > 0) resolve(piped.queue.shift());
    else if (piped.ended) resolve("");
    else piped.waiting = resolve;
  });
}

// Reads a line without echoing it. Overriding readline's internal
// _writeToOutput is the usual trick for this, and it fights readline's own
// cursor redraws; driving stdin in raw mode is both simpler and testable.
function promptHidden(question) {
  return new Promise((resolve) => {
    process.stdout.write(question);

    if (!process.stdin.isTTY) {
      readPipedLine().then((line) => {
        process.stdout.write("\n");
        resolve(line);
      });
      return;
    }

    let buffer = "";
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");

    const finish = (value) => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.removeListener("data", onData);
      process.stdout.write("\n");
      resolve(value);
    };

    // One data event can carry several characters (a paste, or fast typing),
    // so this walks the chunk rather than assuming a single keypress.
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ENTER.includes(ch)) {
          finish(buffer);
          return;
        }
        if (ch === CTRL_C) {
          // Raw mode swallows the default SIGINT, so exit explicitly rather
          // than leaving the terminal stuck with echo disabled.
          process.stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (BACKSPACE.includes(ch)) {
          buffer = buffer.slice(0, -1);
        } else {
          buffer += ch;
        }
      }
    };

    process.stdin.on("data", onData);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const email = args.find((a) => !a.startsWith("--"));
  const which = args.includes("--project") ? "project" : "installed";
  const dbPath = DATABASES[which];

  if (!email) {
    console.error("Usage: node scripts/reset-local-password.js <email> [--installed | --project]");
    process.exit(1);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`No database at ${dbPath}`);
    process.exit(1);
  }

  let db;
  try {
    db = new Database(dbPath);
  } catch (err) {
    console.error(`Couldn't open ${dbPath}: ${err.message}`);
    console.error("If Game Hub is running, quit it (including the tray icon) and try again.");
    process.exit(1);
  }

  const hasUserTable =
    db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'table' AND name = 'User'").get().n > 0;
  if (!hasUserTable) {
    console.error(`${dbPath} isn't a Game Hub database (no User table).`);
    db.close();
    process.exit(1);
  }

  const user = db.prepare("SELECT id, email, displayName FROM User WHERE lower(email) = lower(?)").get(email);
  if (!user) {
    const all = db.prepare("SELECT email FROM User").all().map((u) => u.email);
    console.error(`No account "${email}" in the ${which} database.`);
    console.error(`Accounts there: ${all.join(", ") || "(none)"}`);
    db.close();
    process.exit(1);
  }

  console.log(`Database : ${dbPath}`);
  console.log(`Account  : ${user.email}${user.displayName ? ` (${user.displayName})` : ""}`);
  console.log("");

  const password = await promptHidden("New password (min 8 characters, input hidden): ");
  if (password.length < 8) {
    console.error("Password must be at least 8 characters. Nothing was changed.");
    db.close();
    process.exit(1);
  }
  const confirm = await promptHidden("Type it again to confirm: ");
  if (password !== confirm) {
    console.error("The two entries didn't match. Nothing was changed.");
    db.close();
    process.exit(1);
  }

  db.prepare("UPDATE User SET passwordHash = ? WHERE id = ?").run(bcrypt.hashSync(password, SALT_ROUNDS), user.id);
  db.close();
  if (piped) piped.rl.close();

  console.log("");
  console.log(`Password updated for ${user.email}. Start Game Hub and sign in with it.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
