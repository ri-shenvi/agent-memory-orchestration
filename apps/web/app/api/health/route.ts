import { checkDatabaseConnection } from "@memory-debugger/db";
import { Redis } from "ioredis";
import { NextResponse } from "next/server";

import { parseWebEnvironment } from "../../../src/environment";
import { checkHealth } from "../../../src/health";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const environment = parseWebEnvironment({
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
  const result = await checkHealth({
    checkDatabase: async () => {
      await checkDatabaseConnection(environment.DATABASE_URL);
    },
    checkRedis: async () => {
      const redis = new Redis(environment.REDIS_URL, {
        connectTimeout: 2_000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      try {
        await redis.connect();
        await redis.ping();
      } finally {
        redis.disconnect();
      }
    },
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
    status: result.status === "healthy" ? 200 : 503,
  });
}
