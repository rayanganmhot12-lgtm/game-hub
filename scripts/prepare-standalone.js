// Next.js `output: "standalone"` produces .next/standalone with a minimal
// server + traced node_modules, but does NOT copy `public/` or `.next/static`
// into it — that's an explicit manual step per Next.js's own docs.
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const standaloneDir = path.join(root, ".next", "standalone");

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

if (!fs.existsSync(standaloneDir)) {
  console.error("`.next/standalone` not found — run `next build` first.");
  process.exit(1);
}

copyDir(path.join(root, "public"), path.join(standaloneDir, "public"));
copyDir(path.join(root, ".next", "static"), path.join(standaloneDir, ".next", "static"));

// Bundle .env so a distributed copy has working config (Steam API key,
// Firebase config, etc.) out of the box — matching the "give a copy to a
// friend and it just works" goal. Next's standalone server reads .env from
// its own working directory automatically.
//
// SESSION_SECRET and ADMIN_EMAIL are stripped before writing: SESSION_SECRET
// is generated fresh per install by electron/main.js (so no two installs
// ever share a session-signing key), and ADMIN_EMAIL staying out entirely
// means nobody but the developer's own environment is admin — admin status
// gates real actions (moderation, broadcast) that reach the Firebase relay
// shared by every install, so it must never be a value baked into every copy.
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  const envContents = fs.readFileSync(envPath, "utf8");
  const strippedEnv = envContents
    .split("\n")
    .filter((line) => !/^\s*(SESSION_SECRET|ADMIN_EMAIL)\s*=/.test(line))
    .join("\n");
  fs.writeFileSync(path.join(standaloneDir, ".env"), strippedEnv);
  console.log("Copied .env into .next/standalone (SESSION_SECRET/ADMIN_EMAIL stripped).");
} else {
  console.warn("No .env found at project root — packaged app will be missing its config.");
}

console.log("Copied public/ and .next/static into .next/standalone.");
