export type DependencyHealth = "healthy" | "unhealthy";

export interface HealthResponse {
  readonly status: DependencyHealth;
  readonly services: {
    readonly application: "healthy";
    readonly database: DependencyHealth;
    readonly redis: DependencyHealth;
  };
}

export interface HealthDependencies {
  readonly checkDatabase: () => Promise<void>;
  readonly checkRedis: () => Promise<void>;
}

export async function checkHealth(
  dependencies: HealthDependencies,
): Promise<HealthResponse> {
  const [database, redis] = await Promise.allSettled([
    dependencies.checkDatabase(),
    dependencies.checkRedis(),
  ]);
  const databaseStatus =
    database.status === "fulfilled" ? "healthy" : "unhealthy";
  const redisStatus = redis.status === "fulfilled" ? "healthy" : "unhealthy";

  return {
    status:
      databaseStatus === "healthy" && redisStatus === "healthy"
        ? "healthy"
        : "unhealthy",
    services: {
      application: "healthy",
      database: databaseStatus,
      redis: redisStatus,
    },
  };
}
