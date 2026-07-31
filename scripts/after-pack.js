// Packaging problems fixed here in `afterPack` (which runs on electron-
// builder's FINAL packaged output, after all its own copying/caching — the
// only point at which nothing can silently undo the fix afterward):
//
// 1. electron-builder's extraResources copy silently drops the standalone
//    server's top-level node_modules (its default file-matching excludes
//    node_modules folders from generic resource copies) — the packaged app
//    can't `require("next")` at runtime without it.
//
// 2. Confirmed by reading the actual compiled output: Next's tracer marks
//    "external" packages (better-sqlite3, @prisma/client) by rewriting their
//    require calls to a build-time hashed name, e.g.
//    `require("better-sqlite3-90e2652d1716b047")` instead of
//    `require("better-sqlite3")`. Node's normal module resolution then walks
//    up from the requiring chunk and finds that exact hashed name one level
//    up, at `.next/standalone/.next/node_modules/<pkg>-<hash>` — which Next
//    creates as a symlink/junction pointing at the ABSOLUTE PATH of the
//    real package on the machine that ran `next build` (confirmed via
//    `readlink`). electron-builder's own extraResources copy carries this
//    symlink through as-is (it's small — just a reparse point — so it
//    survives the node_modules exclusion that drops real directories).
//    On the developer's own machine this silently "works" (the absolute
//    path happens to exist) while being both wrong-ABI for a native module
//    and completely broken on any other machine, since that path doesn't
//    exist there. The fix: replace every such symlink with a real copy of
//    the corresponding top-level package from the packaged node_modules
//    (which we already carry in and, for better-sqlite3, rebuild for
//    Electron's ABI below).
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// electron-builder (and whatever antivirus/indexer touches freshly-written
// files on Windows) can hold a brief lock on individual files mid-copy —
// retrying a few times rides out that transient window instead of failing
// the whole package build over one file.
function cpSyncWithRetry(src, dest, options, retries = 5, delayMs = 500) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      fs.cpSync(src, dest, options);
      return;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`afterPack: copy of ${src} failed (attempt ${attempt}/${retries}: ${err.code || err.message}), retrying...`);
      sleepSync(delayMs);
    }
  }
}

module.exports = async function (context) {
  const root = path.join(__dirname, "..");
  const standaloneDest = path.join(context.appOutDir, "resources", "standalone");

  // electron-builder's extraResources copy excludes every node_modules
  // folder it finds, including this top-level one — re-copy it explicitly
  // so the packaged app can resolve its dependencies (e.g. `require("next")`,
  // `require("better-sqlite3")`) at runtime.
  const standaloneNodeModulesSrc = path.join(root, ".next", "standalone", "node_modules");
  const standaloneNodeModulesDest = path.join(standaloneDest, "node_modules");

  if (!fs.existsSync(standaloneNodeModulesSrc)) {
    throw new Error(`Expected node_modules at ${standaloneNodeModulesSrc} but it wasn't found.`);
  }
  cpSyncWithRetry(standaloneNodeModulesSrc, standaloneNodeModulesDest, { recursive: true });
  console.log(`afterPack: copied ${standaloneNodeModulesSrc} into ${standaloneNodeModulesDest}`);

  const rebuiltBinary = rebuildBetterSqlite3ForElectron(root);
  const replacedTopLevel = overwriteAllCopies(standaloneNodeModulesDest, rebuiltBinary);
  console.log(`afterPack: replaced ${replacedTopLevel} copy/copies of better_sqlite3.node with the Electron-ABI build.`);

  // Now fix up the nested .next/node_modules/<pkg>-<hash> symlinks that
  // electron-builder's own copy carried over pointing at the build
  // machine's absolute paths (see problem #2 above).
  const nestedNodeModules = path.join(standaloneDest, ".next", "node_modules");
  const repointed = repointHashedExternalSymlinks(nestedNodeModules, standaloneNodeModulesDest);
  console.log(`afterPack: repointed ${repointed} traced dependency symlink(s) to self-contained copies.`);

  // Safety net: re-scan for any better_sqlite3.node the repoint step just
  // introduced (it should already be Electron-ABI, since it was copied from
  // the already-fixed top-level directory, but this costs nothing and
  // catches any other path we haven't anticipated).
  const replacedNested = overwriteAllCopies(nestedNodeModules, rebuiltBinary);
  if (replacedNested > 0) {
    console.log(`afterPack: replaced ${replacedNested} additional copy/copies of better_sqlite3.node with the Electron-ABI build.`);
  }

  // Final assertion: nothing under the packaged output should be a symlink
  // at all at this point. Catches any traced external package this script
  // doesn't yet know to repoint — turning "silently broken on a friend's
  // PC" into "build fails on mine."
  const remainingSymlinks = findSymlinks(standaloneDest);
  if (remainingSymlinks.length > 0) {
    throw new Error(
      `afterPack: ${remainingSymlinks.length} symlink(s) remain in the packaged output (should be zero):\n${remainingSymlinks.join("\n")}`
    );
  }
};

function findSymlinks(dir) {
  if (!fs.existsSync(dir)) return [];
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      found.push(full);
    } else if (entry.isDirectory()) {
      found.push(...findSymlinks(full));
    }
  }
  return found;
}

function rebuildBetterSqlite3ForElectron(root) {
  const electronVersion = require(path.join(root, "node_modules", "electron", "package.json")).version;
  // node-gyp/@electron/rebuild's dependency walker breaks on paths
  // containing a space (this project's own folder is "Game hub v5") —
  // scratch work has to happen somewhere space-free, not under the
  // project directory. Also isolated from the project's real node_modules,
  // since rebuilding THAT in place for Electron's ABI would break `npm run
  // dev`, which needs the plain-Node.js ABI.
  const scratchDir = path.join(os.tmpdir(), "gamehub-electron-native-scratch");
  const srcModule = path.join(root, "node_modules", "better-sqlite3");

  fs.rmSync(scratchDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(scratchDir, "node_modules"), { recursive: true });
  fs.cpSync(srcModule, path.join(scratchDir, "node_modules", "better-sqlite3"), { recursive: true });
  fs.writeFileSync(
    path.join(scratchDir, "package.json"),
    JSON.stringify(
      {
        name: "gamehub-electron-native-scratch",
        version: "0.0.0",
        private: true,
        // electron-rebuild's module walker filters to declared dependencies
        // by default (types: "prod,optional") — an undeclared node_modules
        // folder is treated as extraneous and silently skipped.
        dependencies: { "better-sqlite3": "*" },
      },
      null,
      2
    )
  );

  execFileSync(
    "npx",
    [
      "electron-rebuild",
      "--force",
      // better-sqlite3's own install step tries to download a prebuilt
      // binary matching whatever ABI it auto-detects first, which can
      // silently win over electron-rebuild's intended target — force an
      // actual from-source compile against Electron's headers instead.
      "--build-from-source",
      "--module-dir",
      scratchDir,
      "--only",
      "better-sqlite3",
      "-v",
      electronVersion,
    ],
    { cwd: root, stdio: "inherit", shell: true }
  );

  const rebuiltBinary = path.join(
    scratchDir,
    "node_modules",
    "better-sqlite3",
    "build",
    "Release",
    "better_sqlite3.node"
  );

  if (!fs.existsSync(rebuiltBinary)) {
    throw new Error(`Expected a rebuilt binary at ${rebuiltBinary} but it wasn't produced.`);
  }

  return rebuiltBinary;
}

function overwriteAllCopies(dir, rebuiltBinary) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      // Never descend into a symlink/junction here — repointHashedExternalSymlinks
      // owns replacing those, and recursing into one would walk out to
      // whatever machine-specific path it targets.
      continue;
    } else if (entry.isDirectory()) {
      count += overwriteAllCopies(full, rebuiltBinary);
    } else if (entry.name === "better_sqlite3.node") {
      fs.copyFileSync(rebuiltBinary, full);
      count += 1;
      console.log(`afterPack: replaced ${full} with the Electron-rebuilt binary.`);
    }
  }
  return count;
}

// Next's tracer leaves symlinks named "<package>-<hash>" (e.g.
// "better-sqlite3-90e2652d1716b047", or "client-2c3a283f134fdcb6" nested
// under a real "@prisma" directory) pointing at the ABSOLUTE PATH of the
// real package on the machine that ran `next build`. The compiled chunks
// require that exact hashed name, so it must exist — but as a real,
// self-contained copy, not a symlink back to one specific developer's PC.
function repointHashedExternalSymlinks(nestedNodeModulesDir, topLevelNodeModulesDir) {
  if (!fs.existsSync(nestedNodeModulesDir)) return 0;
  let count = 0;

  function walk(dir, scopeSegments) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const entryPath = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        const strippedName = entry.name.replace(/-[0-9a-f]{8,}$/i, "");
        const source = path.join(topLevelNodeModulesDir, ...scopeSegments, strippedName);
        if (!fs.existsSync(source)) {
          // Never leave a dev-machine-absolute-path symlink in the shipped
          // installer — that's exactly the bug this function exists to fix.
          // A silent skip here would ship a build that only works on this
          // machine, discoverable only by a friend whose app crashes.
          throw new Error(
            `afterPack: no top-level counterpart at ${source} for traced symlink ${entryPath} — refusing to package a dev-machine-only symlink.`
          );
        }
        // A plain (non-recursive) rmdir removes only the junction/symlink
        // itself. Using {recursive: true} here would be dangerous: on
        // Windows, recursively removing a directory junction follows the
        // reparse point and deletes the TARGET's contents — which for
        // these symlinks is the developer's real node_modules package.
        fs.rmdirSync(entryPath);
        fs.cpSync(source, entryPath, { recursive: true });
        count += 1;
        console.log(`afterPack: repointed ${entryPath} (was a dev-machine symlink) to a self-contained copy of ${source}`);
      } else if (entry.isDirectory()) {
        walk(entryPath, scopeSegments.concat(entry.name));
      }
    }
  }

  walk(nestedNodeModulesDir, []);
  return count;
}
