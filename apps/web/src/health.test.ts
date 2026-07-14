import { describe, expect, it, vi } from "vitest";

import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("reports healthy when both dependencies respond", async () => {
    const result = await checkHealth({
      checkDatabase: vi.fn().mockResolvedValue(undefined),
      checkRedis: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({
      status: "healthy",
      services: {
        application: "healthy",
        database: "healthy",
        redis: "healthy",
      },
    });
  });

  it("reports only sanitized dependency states", async () => {
    const result = await checkHealth({
      checkDatabase: vi
        .fn()
        .mockRejectedValue(new Error("postgresql://admin:secret@db/internal")),
      checkRedis: vi.fn().mockResolvedValue(undefined),
    });

    expect(result).toEqual({
      status: "unhealthy",
      services: {
        application: "healthy",
        database: "unhealthy",
        redis: "healthy",
      },
    });
    expect(JSON.stringify(result)).not.toContain("secret");
  });
});
