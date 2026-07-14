import { getPrismaClient } from "../src/client";

const connectionString = process.env.DATABASE_URL;

if (connectionString === undefined) {
  throw new Error("Database connection configuration is required.");
}

const prisma = getPrismaClient(connectionString);

async function main(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
}

await main().finally(async () => {
  await prisma.$disconnect();
});
