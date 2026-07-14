import { z } from "zod";

const webEnvironmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
});

export type WebEnvironment = z.infer<typeof webEnvironmentSchema>;

export function parseWebEnvironment(
  values: Readonly<Record<string, string | undefined>>,
): WebEnvironment {
  const result = webEnvironmentSchema.safeParse(values);

  if (!result.success) {
    throw new Error("Invalid web environment configuration");
  }

  return result.data;
}
