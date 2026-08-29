import { fileURLToPath } from "node:url"
import { loadEnv } from "vite"
import { defineConfig } from "vitest/config"

// Tests hit the real (only) Supabase project — there's no separate
// local/staging database available in this environment — so they need
// the same credentials the dev server reads from .env.local. Every
// fixture these tests create is namespaced and torn down in the same
// run (see src/utils/__tests__/orgIsolation.test.ts); nothing here is
// a persistent addition to the schema or data.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  test: {
    env: loadEnv("", process.cwd(), ""),
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
})
