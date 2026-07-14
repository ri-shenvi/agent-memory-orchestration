import { describe, expect, it } from "vitest";

import { parseWorkerEnvironment } from "./environment.js";

describe("parseWorkerEnvironment", () => {
  it("requires database and Redis URLs", () => {
    expect(() => parseWorkerEnvironment({ REDIS_URL: "not-a-url" })).toThrow(
      "Invalid worker environment configuration",
    );
  });

  it("returns only validated values", () => {
    expect(
      parseWorkerEnvironment({
        DATABASE_URL: "postgresql://user:secret@localhost:5432/app",
        REDIS_URL: "redis://localhost:6379",
        PROVIDER_API_KEY: "must-not-be-returned",
      }),
    ).toEqual({
      DATABASE_URL: "postgresql://user:secret@localhost:5432/app",
      REDIS_URL: "redis://localhost:6379",
    });
  });
});
