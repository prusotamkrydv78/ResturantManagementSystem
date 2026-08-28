import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Two kinds of test live here, and they are kept apart on purpose.
 *
 * `tests/unit` is pure frontend logic with no backend: it runs anywhere, any time.
 * `tests/contract` talks to a real API over HTTP and is what catches the class of
 * bug that builds cannot see — a response whose values do not match what the
 * frontend believes about them.
 *
 * Contract tests are not configured to skip when the API is absent. A suite that
 * quietly passes when it tested nothing is worse than one that fails loudly.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The seed builds a restaurant through the real endpoints, and the lifecycle
    // tests walk an order across three roles. Neither is fast.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Contract tests share one seeded restaurant per file and assert on what is on
    // the floor, so files must not interleave against the same backend.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
