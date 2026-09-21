import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next. The "**/" prefix matters:
    // an unprefixed pattern only matches at this config's own root, not
    // inside the ai-marketing-os-* sibling directories below (each a
    // separate git-worktree checkout of this same repo) — without it,
    // linting from root walked into their own .next build output too.
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "next-env.d.ts",
    // Sibling git-worktree checkouts of this same repo — not this
    // project's own source, so root-level tooling shouldn't lint them.
    "ai-marketing-os-*/**",
  ]),
]);

export default eslintConfig;
