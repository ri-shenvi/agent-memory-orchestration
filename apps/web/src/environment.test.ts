import { describe, expect, it } from "vitest";

import { parseWebEnvironment } from "./environment";

describe("parseWebEnvironment", () => {
  it("accepts valid dependency URLs without returning unrelated values", () => {
    expect(
      parseWebEnvironment({
        DATABASE_URL: "postgresql://user:secret@localhost:5432/app",
        REDIS_URL: "redis://localhost:6379",
        UNRELATED_SECRET: "must-not-be-returned",
      }),
    ).toEqual({
      DATABASE_URL: "postgresql://user:secret@localhost:5432/app",
      REDIS_URL: "redis://localhost:6379",
    });
  });

  it("rejects missing dependency configuration", () => {
    expect(() => parseWebEnvironment({})).toThrow(
      "Invalid web environment configuration",
    );
  });
});
