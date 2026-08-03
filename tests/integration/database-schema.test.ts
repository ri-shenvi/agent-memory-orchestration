import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { getPrismaClient } from "../../packages/db/src/client";

const execFileAsync = promisify(execFile);
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://memory_debugger:memory_debugger@localhost:5432/memory_debugger";
const prisma = getPrismaClient(databaseUrl);

interface CountRow {
  readonly count: bigint;
}

interface IndexRow {
  readonly indexdef: string;
  readonly indexname: string;
}

async function insertOwnershipFixture(suffix: string): Promise<{
  readonly agentId: string;
  readonly agentUserId: string;
  readonly conversationId: string;
  readonly workspaceId: string;
}> {
  const workspaceId = "schema-workspace-" + suffix;
  const agentId = "schema-agent-" + suffix;
  const agentUserId = "schema-user-" + suffix;
  const conversationId = "schema-conversation-" + suffix;

  await prisma.$executeRawUnsafe(
    'INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt") VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    workspaceId,
    "Schema Workspace " + suffix,
  );
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Agent" ("id", "workspaceId", "slug", "name", "systemPrompt", "provider", "protocol", "model", "memoryEnabled", "memoryConfig", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, \'test\', \'mock\', \'chat-completions\', \'mock\', true, \'{}\'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    agentId,
    workspaceId,
    "agent-" + suffix,
    "Agent " + suffix,
  );
  await prisma.$executeRawUnsafe(
    'INSERT INTO "AgentUser" ("id", "workspaceId", "externalUserId", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    agentUserId,
    workspaceId,
    "user-" + suffix,
  );
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Conversation" ("id", "agentId", "agentUserId", "createdAt", "updatedAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    conversationId,
    agentId,
    agentUserId,
  );

  return { agentId, agentUserId, conversationId, workspaceId };
}

async function insertMemory(input: {
  readonly agentId: string;
  readonly agentUserId: string;
  readonly canonicalKey?: string;
  readonly id: string;
  readonly importanceScore?: number;
  readonly status?: string;
}): Promise<void> {
  await prisma.$executeRawUnsafe(
    'INSERT INTO "Memory" ("id", "agentId", "agentUserId", "memoryType", "canonicalKey", "content", "importanceScore", "confidenceScore", "status", "source", "accessCount", "version", "createdAt", "updatedAt") VALUES ($1, $2, $3, \'USER_PREFERENCE\', $4, \'test memory\', $5, 0.8, $6::"MemoryStatus", \'schema-test\', 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
    input.id,
    input.agentId,
    input.agentUserId,
    input.canonicalKey ?? null,
    input.importanceScore ?? 0.8,
    input.status ?? "ACTIVE",
  );
}

beforeAll(async () => {
  await prisma.$queryRawUnsafe("SELECT 1");
});

afterAll(async () => {
  await prisma.$executeRawUnsafe(
    'DELETE FROM "Workspace" WHERE "id" LIKE \'schema-workspace-%\'',
  );
  await prisma.$disconnect();
});

describe("Milestone 1A database schema", () => {
  test("enables pgvector and creates a vector(1536) memory column", async () => {
    const extensions = await prisma.$queryRawUnsafe<Array<{ extname: string }>>(
      "SELECT extname FROM pg_extension WHERE extname = 'vector'",
    );
    const columns = await prisma.$queryRawUnsafe<
      Array<{ formatted_type: string; typname: string }>
    >(
      "SELECT format_type(a.atttypid, a.atttypmod) AS formatted_type, t.typname FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_type t ON t.oid = a.atttypid WHERE c.relname = 'Memory' AND a.attname = 'embedding' AND NOT a.attisdropped",
    );

    expect(extensions).toEqual([{ extname: "vector" }]);
    expect(columns).toEqual([
      { formatted_type: "vector(1536)", typname: "vector" },
    ]);
  });

  test("creates the required vector and partial memory indexes", async () => {
    const indexes = await prisma.$queryRawUnsafe<IndexRow[]>(
      "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('memory_embedding_hnsw_idx', 'memory_active_lookup_idx', 'memory_active_canonical_key_idx') ORDER BY indexname",
    );

    expect(indexes).toHaveLength(3);
    expect(
      indexes.find((row) => row.indexname === "memory_embedding_hnsw_idx")
        ?.indexdef,
    ).toContain("USING hnsw (embedding vector_cosine_ops)");
    expect(
      indexes.find((row) => row.indexname === "memory_active_lookup_idx")
        ?.indexdef,
    ).toContain("WHERE (status = 'ACTIVE'::\"MemoryStatus\")");
    expect(
      indexes.find(
        (row) => row.indexname === "memory_active_canonical_key_idx",
      )?.indexdef,
    ).toContain("UNIQUE");
  });

  test("enforces active canonical keys per agent and user", async () => {
    const first = await insertOwnershipFixture("canonical-a");
    await insertMemory({
      agentId: first.agentId,
      agentUserId: first.agentUserId,
      canonicalKey: "preference.delivery_location",
      id: "schema-memory-canonical-a1",
    });
    await expect(
      insertMemory({
        agentId: first.agentId,
        agentUserId: first.agentUserId,
        canonicalKey: "preference.delivery_location",
        id: "schema-memory-canonical-a2",
      }),
    ).rejects.toThrow();

    await prisma.$executeRawUnsafe(
      'UPDATE "Memory" SET "status" = \'SUPERSEDED\' WHERE "id" = $1',
      "schema-memory-canonical-a1",
    );
    await expect(
      insertMemory({
        agentId: first.agentId,
        agentUserId: first.agentUserId,
        canonicalKey: "preference.delivery_location",
        id: "schema-memory-canonical-a3",
      }),
    ).resolves.toBeUndefined();

    const second = await insertOwnershipFixture("canonical-b");
    await expect(
      insertMemory({
        agentId: second.agentId,
        agentUserId: second.agentUserId,
        canonicalKey: "preference.delivery_location",
        id: "schema-memory-canonical-b1",
      }),
    ).resolves.toBeUndefined();
  });

  test.each([-0.01, 1.01])(
    "rejects an out-of-range score of %s",
    async (score) => {
      const suffix = "score-" + String(score).replace(".", "-");
      const fixture = await insertOwnershipFixture(suffix);
      await expect(
        insertMemory({
          agentId: fixture.agentId,
          agentUserId: fixture.agentUserId,
          id: "schema-memory-" + suffix,
          importanceScore: score,
        }),
      ).rejects.toThrow();
    },
  );

  test("enforces run-memory and run-event uniqueness", async () => {
    const fixture = await insertOwnershipFixture("run-unique");
    await insertMemory({
      agentId: fixture.agentId,
      agentUserId: fixture.agentUserId,
      id: "schema-memory-run-unique",
    });
    await prisma.$executeRawUnsafe(
      'INSERT INTO "AgentRun" ("id", "agentId", "agentUserId", "conversationId", "status", "inputText", "provider", "model", "effectiveConfig", "startedAt") VALUES ($1, $2, $3, $4, \'QUEUED\', \'test\', \'mock\', \'mock\', \'{}\'::jsonb, CURRENT_TIMESTAMP)',
      "schema-run-unique",
      fixture.agentId,
      fixture.agentUserId,
      fixture.conversationId,
    );
    await prisma.$executeRawUnsafe(
      'INSERT INTO "RunMemory" ("id", "runId", "memoryId", "rank", "semanticScore", "recencyScore", "importanceScore", "confidenceScore", "typeBoost", "finalScore", "selectionReason", "includedInContext", "estimatedTokenCount") VALUES ($1, $2, $3, 1, 0.8, 0.8, 0.8, 0.8, 1, 0.84, \'selected\', true, 4)',
      "schema-run-memory-1",
      "schema-run-unique",
      "schema-memory-run-unique",
    );
    await expect(
      prisma.$executeRawUnsafe(
        'INSERT INTO "RunMemory" ("id", "runId", "memoryId", "rank", "semanticScore", "recencyScore", "importanceScore", "confidenceScore", "typeBoost", "finalScore", "selectionReason", "includedInContext", "estimatedTokenCount") VALUES ($1, $2, $3, 2, 0.7, 0.7, 0.8, 0.8, 1, 0.79, \'duplicate\', false, 4)',
        "schema-run-memory-2",
        "schema-run-unique",
        "schema-memory-run-unique",
      ),
    ).rejects.toThrow();

    await prisma.$executeRawUnsafe(
      'INSERT INTO "RunEvent" ("id", "runId", "eventType", "sequence", "createdAt") VALUES ($1, $2, \'run.queued\', 1, CURRENT_TIMESTAMP)',
      "schema-run-event-1",
      "schema-run-unique",
    );
    await expect(
      prisma.$executeRawUnsafe(
        'INSERT INTO "RunEvent" ("id", "runId", "eventType", "sequence", "createdAt") VALUES ($1, $2, \'run.duplicate\', 1, CURRENT_TIMESTAMP)',
        "schema-run-event-2",
        "schema-run-unique",
      ),
    ).rejects.toThrow();
  });

  test("the deterministic seed is idempotent", async () => {
    const options = {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
    };
    const command = "pnpm --filter @memory-debugger/db db:seed";
    await execFileAsync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", command],
      options,
    );
    await execFileAsync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", command],
      options,
    );

    const tables = [
      ['"Workspace"', '"name"', "Memory Debugger Demo"],
      ['"Agent"', '"slug"', "order-assistant"],
      ['"AgentUser"', '"externalUserId"', "user-123"],
      ['"DemoOrder"', '"orderNumber"', "ORD-1042"],
    ] as const;
    for (const [table, column, value] of tables) {
      const rows = await prisma.$queryRawUnsafe<CountRow[]>(
        "SELECT COUNT(*) AS count FROM " + table + " WHERE " + column + " = $1",
        value,
      );
      expect(rows[0]?.count).toBe(1n);
    }
  });
});
