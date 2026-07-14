import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 30_000,
    include: ["tests/integration/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
