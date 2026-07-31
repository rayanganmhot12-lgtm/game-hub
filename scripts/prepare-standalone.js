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
// session secret, admin email) out of the box — matching the "give a copy to
// a friend and it just works" goal. Next's standalone server reads .env from
// its own working directory automatically.
const envPath = path.join(root, ".env");
if (fs.existsSync(envPath)) {
  fs.copyFileSync(envPath, path.join(standaloneDir, ".env"));
  console.log("Copied .env into .next/standalone.");
} else {
  console.warn("No .env found at project root — packaged app will be missing its config.");
}

console.log("Copied public/ and .next/static into .next/standalone.");
