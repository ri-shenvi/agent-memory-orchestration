import { z } from "zod";

const workerEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

export type WorkerEnvironment = z.infer<typeof workerEnvironmentSchema>;

export function parseWorkerEnvironment(
  values: Readonly<Record<string, string | undefined>>,
): WorkerEnvironment {
  const result = workerEnvironmentSchema.safeParse(values);

  if (!result.success) {
    throw new Error("Invalid worker environment configuration");
  }

  return result.data;
}
