import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const prismaCli = require.resolve("prisma/build/index.js");
const result = spawnSync(process.execPath, [prismaCli, "generate"], {
  cwd: new URL("..", import.meta.url),
  env: {
    ...process.env,
    // Prisma 7 generation uses its bundled WASM parser. This avoids an
    // unnecessary native migration-engine download during client generation.
    PRISMA_SCHEMA_ENGINE_BINARY: process.execPath,
  },
  stdio: "inherit",
});

if (result.error !== undefined) {
  throw result.error;
}

process.exitCode = result.status ?? 1;
