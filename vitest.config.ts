import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: [
      "**/dist/**",
      "**/node_modules/**",
      ".pnpm-store*/**",
      "tests/e2e/**",
      "tests/integration/**",
    ],
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.{ts,tsx}"],
  },
});
