import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "./generated/prisma/client";

interface PrismaGlobal {
  connectionString: string | undefined;
  prisma: PrismaClient | undefined;
}

const globalForPrisma = globalThis as unknown as PrismaGlobal;

export function getPrismaClient(connectionString: string): PrismaClient {
  if (connectionString.trim().length === 0) {
    throw new Error("Database connection configuration is required.");
  }

  if (
    globalForPrisma.prisma !== undefined &&
    globalForPrisma.connectionString === connectionString
  ) {
    return globalForPrisma.prisma;
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.connectionString = connectionString;
    globalForPrisma.prisma = prisma;
  }

  return prisma;
}

export async function checkDatabaseConnection(
  connectionString: string,
): Promise<void> {
  const prisma = getPrismaClient(connectionString);
  await prisma.$queryRaw`SELECT 1`;
}
