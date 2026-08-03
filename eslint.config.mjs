import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "release/**",
    "next-env.d.ts",
    "electron/**",
    "scripts/**",
    // Agent worktrees are full checkouts of this same repo living inside it.
    // Without this, one lint run reports every file twice, and the ignores
    // above miss the copies entirely — they are anchored to the config's own
    // directory, so "electron/**" never matches ".claude/worktrees/x/electron".
    ".claude/**",
  ]),
]);

export default eslintConfig;
