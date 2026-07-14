import { parseWorkerEnvironment } from "./environment.js";

const environment = parseWorkerEnvironment({
  DATABASE_URL:
    process.env.DATABASE_URL ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "postgresql://memory_debugger:memory_debugger@localhost:5432/memory_debugger"),
  REDIS_URL:
    process.env.REDIS_URL ??
    (process.env.NODE_ENV === "production"
      ? undefined
      : "redis://localhost:6379"),
});

console.info(
  `Background worker is ready for ${new URL(environment.REDIS_URL).protocol}`,
);

function shutdown(): void {
  process.exit(0);
}

process.once("SIGINT", () => {
  shutdown();
});
process.once("SIGTERM", () => {
  shutdown();
});

process.stdin.resume();
