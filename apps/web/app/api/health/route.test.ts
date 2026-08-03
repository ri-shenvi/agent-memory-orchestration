import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkDatabaseConnection: vi.fn(),
  redisConnect: vi.fn(),
  redisDisconnect: vi.fn(),
  redisOn: vi.fn(),
  redisPing: vi.fn(),
}));

vi.mock("@memory-debugger/db", () => ({
  checkDatabaseConnection: mocks.checkDatabaseConnection,
}));

vi.mock("ioredis", () => ({
  Redis: class {
    connect = mocks.redisConnect;
    disconnect = mocks.redisDisconnect;
    on = mocks.redisOn;
    ping = mocks.redisPing;
  },
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkDatabaseConnection.mockResolvedValue(undefined);
    mocks.redisConnect.mockResolvedValue(undefined);
    mocks.redisPing.mockResolvedValue("PONG");
  });

  it("handles Redis errors without exposing raw diagnostics", async () => {
    mocks.redisConnect.mockRejectedValue(
      new Error("redis://user:secret@localhost:6379"),
    );

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({
      status: "unhealthy",
      services: {
        application: "healthy",
        database: "healthy",
        redis: "unhealthy",
      },
    });
    expect(JSON.stringify(body)).not.toContain("secret");
    expect(mocks.redisOn).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mocks.redisDisconnect).toHaveBeenCalledOnce();
  });
});
