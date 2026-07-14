import {
  MemoryStatus,
  MemoryType,
  Prisma,
  PrismaClient,
} from "@prisma/client";

export interface MemoryRecord {
  readonly id: string;
  readonly agentId: string;
  readonly agentUserId: string;
  readonly sourceMessageId: string | null;
  readonly memoryType: MemoryType;
  readonly canonicalKey: string | null;
  readonly content: string;
  readonly normalizedContent: string | null;
  readonly metadata: Prisma.JsonValue | null;
  readonly embeddingModel: string | null;
  readonly importanceScore: number;
  readonly confidenceScore: number;
  readonly status: MemoryStatus;
  readonly source: string;
  readonly validFrom: Date | null;
  readonly validTo: Date | null;
  readonly expiresAt: Date | null;
  readonly lastAccessedAt: Date | null;
  readonly accessCount: number;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface SemanticMemoryResult extends MemoryRecord {
  readonly semanticScore: number;
}

export interface CreateMemoryInput {
  readonly agentId: string;
  readonly agentUserId: string;
  readonly sourceMessageId?: string | null;
  readonly memoryType: MemoryType;
  readonly canonicalKey?: string | null;
  readonly content: string;
  readonly normalizedContent?: string | null;
  readonly metadata?: Prisma.InputJsonValue | null;
  readonly embedding?: readonly number[] | null;
  readonly embeddingModel?: string | null;
  readonly importanceScore?: number;
  readonly confidenceScore?: number;
  readonly source: string;
  readonly validFrom?: Date | null;
  readonly validTo?: Date | null;
  readonly expiresAt?: Date | null;
}

export interface UpdateMemoryInput {
  readonly memoryId: string;
  readonly agentId: string;
  readonly agentUserId: string;
  readonly expectedVersion: number;
  readonly changedByRunId?: string | null;
  readonly changeReason?: string | null;
  readonly content?: string;
  readonly normalizedContent?: string | null;
  readonly metadata?: Prisma.InputJsonValue | null;
  readonly embedding?: readonly number[] | null;
  readonly embeddingModel?: string | null;
  readonly importanceScore?: number;
  readonly confidenceScore?: number;
  readonly source?: string;
  readonly validFrom?: Date | null;
  readonly validTo?: Date | null;
  readonly expiresAt?: Date | null;
}

export interface SemanticSearchInput {
  readonly agentId: string;
  readonly agentUserId: string;
  readonly embedding: readonly number[];
  readonly limit?: number;
  readonly memoryTypes?: readonly MemoryType[];
  readonly minSimilarity?: number;
  readonly now?: Date;
}

export interface ImportantMemorySearchInput {
  readonly agentId: string;
  readonly agentUserId: string;
  readonly limit?: number;
  readonly memoryTypes?: readonly MemoryType[];
  readonly minimumImportance?: number;
  readonly now?: Date;
}

export interface ActiveMemorySearchInput {
  readonly agentId: string;
  readonly agentUserId: string;
  readonly memoryTypes: readonly MemoryType[];
  readonly limit?: number;
  readonly now?: Date;
}

export class MemoryNotFoundError extends Error {
  public readonly code = "MEMORY_NOT_FOUND";

  public constructor(memoryId: string) {
    super(`Memory ${memoryId} was not found or is not active.`);
    this.name = "MemoryNotFoundError";
  }
}

export class MemoryVersionConflictError extends Error {
  public readonly code = "MEMORY_VERSION_CONFLICT";

  public constructor(
    memoryId: string,
    expectedVersion: number,
    actualVersion: number,
  ) {
    super(
      `Memory ${memoryId} version conflict: expected ${expectedVersion}, actual ${actualVersion}.`,
    );
    this.name = "MemoryVersionConflictError";
  }
}

export class InvalidEmbeddingError extends Error {
  public readonly code = "INVALID_EMBEDDING";

  public constructor(message: string) {
    super(message);
    this.name = "InvalidEmbeddingError";
  }
}

export class StaleEmbeddingError extends Error {
  public readonly code = "STALE_EMBEDDING";

  public constructor(memoryId: string) {
    super(
      `Memory ${memoryId} content changed without a replacement embedding.`,
    );
    this.name = "StaleEmbeddingError";
  }
}

const memorySelect = {
  id: true,
  agentId: true,
  agentUserId: true,
  sourceMessageId: true,
  memoryType: true,
  canonicalKey: true,
  content: true,
  normalizedContent: true,
  metadata: true,
  embeddingModel: true,
  importanceScore: true,
  confidenceScore: true,
  status: true,
  source: true,
  validFrom: true,
  validTo: true,
  expiresAt: true,
  lastAccessedAt: true,
  accessCount: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MemorySelect;

type SelectedMemory = Prisma.MemoryGetPayload<{
  select: typeof memorySelect;
}>;

const DEFAULT_SEMANTIC_LIMIT = 30;
const DEFAULT_IMPORTANT_LIMIT = 10;
const DEFAULT_ACTIVE_TYPE_LIMIT = 50;
const MAX_QUERY_LIMIT = 200;

/**
 * Owns all Memory persistence, including pgvector SQL.
 *
 * No code outside packages/db should issue raw vector SQL. The repository
 * intentionally excludes the unsupported `embedding` column from ordinary
 * Prisma reads and exposes only normalized records to callers.
 */
export class MemoryRepository {
  public constructor(
    private readonly prisma: PrismaClient,
    private readonly embeddingDimensions: number,
  ) {
    if (!Number.isInteger(embeddingDimensions) || embeddingDimensions <= 0) {
      throw new InvalidEmbeddingError(
        "embeddingDimensions must be a positive integer.",
      );
    }
  }

  public async getById(input: {
    readonly memoryId: string;
    readonly agentId: string;
    readonly agentUserId: string;
    readonly includeInactive?: boolean;
  }): Promise<MemoryRecord | null> {
    const memory = await this.prisma.memory.findFirst({
      where: {
        id: input.memoryId,
        agentId: input.agentId,
        agentUserId: input.agentUserId,
        ...(input.includeInactive ? {} : { status: MemoryStatus.ACTIVE }),
      },
      select: memorySelect,
    });

    return memory === null ? null : toMemoryRecord(memory);
  }

  public async getByIds(input: {
    readonly memoryIds: readonly string[];
    readonly agentId: string;
    readonly agentUserId: string;
    readonly includeInactive?: boolean;
  }): Promise<MemoryRecord[]> {
    const ids = uniqueStrings(input.memoryIds);
    if (ids.length === 0) {
      return [];
    }

    const memories = (await this.prisma.memory.findMany({
      where: {
        id: { in: ids },
        agentId: input.agentId,
        agentUserId: input.agentUserId,
        ...(input.includeInactive ? {} : { status: MemoryStatus.ACTIVE }),
      },
      select: memorySelect,
    })) as SelectedMemory[];

    const byId = new Map<string, MemoryRecord>(
      memories.map((memory: SelectedMemory) => [
        memory.id,
        toMemoryRecord(memory),
      ]),
    );

    return ids.flatMap<MemoryRecord>((id) => {
      const memory = byId.get(id);
      return memory === undefined ? [] : [memory];
    });
  }

  public async findActiveByCanonicalKey(input: {
    readonly agentId: string;
    readonly agentUserId: string;
    readonly canonicalKey: string;
    readonly now?: Date;
  }): Promise<MemoryRecord | null> {
    const now = input.now ?? new Date();
    const canonicalKey = normalizeCanonicalKey(input.canonicalKey);

    const memory = await this.prisma.memory.findFirst({
      where: {
        agentId: input.agentId,
        agentUserId: input.agentUserId,
        canonicalKey,
        status: MemoryStatus.ACTIVE,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [{ updatedAt: "desc" }, { confidenceScore: "desc" }],
      select: memorySelect,
    });

    return memory === null ? null : toMemoryRecord(memory);
  }

  public async searchSemantic(
    input: SemanticSearchInput,
  ): Promise<SemanticMemoryResult[]> {
    const limit = clampLimit(input.limit ?? DEFAULT_SEMANTIC_LIMIT);
    const now = input.now ?? new Date();
    const minSimilarity = clampScore(input.minSimilarity ?? 0);
    const vectorLiteral = this.toVectorLiteral(input.embedding);
    const memoryTypeClause = buildMemoryTypeClause(input.memoryTypes);

    const rows = await this.prisma.$queryRaw<SemanticMemoryResult[]>(
      Prisma.sql`
        SELECT
          m."id",
          m."agentId",
          m."agentUserId",
          m."sourceMessageId",
          m."memoryType",
          m."canonicalKey",
          m."content",
          m."normalizedContent",
          m."metadata",
          m."embeddingModel",
          m."importanceScore",
          m."confidenceScore",
          m."status",
          m."source",
          m."validFrom",
          m."validTo",
          m."expiresAt",
          m."lastAccessedAt",
          m."accessCount",
          m."version",
          m."createdAt",
          m."updatedAt",
          1 - (m."embedding" <=> ${vectorLiteral}::vector) AS "semanticScore"
        FROM "Memory" AS m
        WHERE m."agentId" = ${input.agentId}
          AND m."agentUserId" = ${input.agentUserId}
          AND m."status" = ${MemoryStatus.ACTIVE}::"MemoryStatus"
          AND m."embedding" IS NOT NULL
          AND (m."expiresAt" IS NULL OR m."expiresAt" > ${now})
          ${memoryTypeClause}
          AND 1 - (m."embedding" <=> ${vectorLiteral}::vector) >= ${minSimilarity}
        ORDER BY
          m."embedding" <=> ${vectorLiteral}::vector ASC,
          m."importanceScore" DESC,
          m."updatedAt" DESC,
          m."id" ASC
        LIMIT ${limit}
      `,
    );

    return rows.map((row: SemanticMemoryResult) => ({
      ...row,
      semanticScore: clampScore(Number(row.semanticScore)),
    }));
  }

  public async findHighImportance(
    input: ImportantMemorySearchInput,
  ): Promise<MemoryRecord[]> {
    const now = input.now ?? new Date();
    const limit = clampLimit(input.limit ?? DEFAULT_IMPORTANT_LIMIT);
    const minimumImportance = clampScore(input.minimumImportance ?? 0);

    const memories = await this.prisma.memory.findMany({
      where: {
        agentId: input.agentId,
        agentUserId: input.agentUserId,
        status: MemoryStatus.ACTIVE,
        importanceScore: { gte: minimumImportance },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        ...(input.memoryTypes && input.memoryTypes.length > 0
          ? { memoryType: { in: [...input.memoryTypes] } }
          : {}),
      },
      orderBy: [
        { importanceScore: "desc" },
        { confidenceScore: "desc" },
        { updatedAt: "desc" },
        { id: "asc" },
      ],
      take: limit,
      select: memorySelect,
    });

    return memories.map(toMemoryRecord);
  }

  public async findActiveByTypes(
    input: ActiveMemorySearchInput,
  ): Promise<MemoryRecord[]> {
    if (input.memoryTypes.length === 0) {
      return [];
    }

    const now = input.now ?? new Date();
    const limit = clampLimit(input.limit ?? DEFAULT_ACTIVE_TYPE_LIMIT);

    const memories = await this.prisma.memory.findMany({
      where: {
        agentId: input.agentId,
        agentUserId: input.agentUserId,
        status: MemoryStatus.ACTIVE,
        memoryType: { in: [...input.memoryTypes] },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: [
        { importanceScore: "desc" },
        { confidenceScore: "desc" },
        { updatedAt: "desc" },
        { id: "asc" },
      ],
      take: limit,
      select: memorySelect,
    });

    return memories.map(toMemoryRecord);
  }

  public async create(input: CreateMemoryInput): Promise<MemoryRecord> {
    validateMemoryContent(input.content);
    validateScore(input.importanceScore ?? 0.5, "importanceScore");
    validateScore(input.confidenceScore ?? 0.5, "confidenceScore");
    validateValidityWindow(input.validFrom ?? null, input.validTo ?? null);

    if (input.embedding !== undefined && input.embedding !== null) {
      this.validateEmbedding(input.embedding);
    }

    return this.prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const memory = await transaction.memory.create({
        data: {
          agentId: input.agentId,
          agentUserId: input.agentUserId,
          sourceMessageId: input.sourceMessageId ?? null,
          memoryType: input.memoryType,
          canonicalKey:
            input.canonicalKey === undefined || input.canonicalKey === null
              ? null
              : normalizeCanonicalKey(input.canonicalKey),
          content: input.content.trim(),
          normalizedContent: input.normalizedContent?.trim() ?? null,
          metadata: toNullableJsonInput(input.metadata),
          embeddingModel: input.embeddingModel ?? null,
          importanceScore: input.importanceScore ?? 0.5,
          confidenceScore: input.confidenceScore ?? 0.5,
          status: MemoryStatus.ACTIVE,
          source: input.source,
          validFrom: input.validFrom ?? null,
          validTo: input.validTo ?? null,
          expiresAt: input.expiresAt ?? null,
        },
        select: memorySelect,
      });

      if (input.embedding !== undefined) {
        await this.setEmbedding(
          transaction,
          memory.id,
          input.embedding,
          input.embeddingModel ?? null,
        );
      }

      return toMemoryRecord(memory);
    });
  }

  public async update(input: UpdateMemoryInput): Promise<MemoryRecord> {
    if (input.content !== undefined) {
      validateMemoryContent(input.content);
    }
    if (input.importanceScore !== undefined) {
      validateScore(input.importanceScore, "importanceScore");
    }
    if (input.confidenceScore !== undefined) {
      validateScore(input.confidenceScore, "confidenceScore");
    }
    if (input.embedding !== undefined && input.embedding !== null) {
      this.validateEmbedding(input.embedding);
    }

    return this.prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const existing = await transaction.memory.findFirst({
        where: {
          id: input.memoryId,
          agentId: input.agentId,
          agentUserId: input.agentUserId,
          status: MemoryStatus.ACTIVE,
        },
        select: memorySelect,
      });

      if (existing === null) {
        throw new MemoryNotFoundError(input.memoryId);
      }

      if (existing.version !== input.expectedVersion) {
        throw new MemoryVersionConflictError(
          input.memoryId,
          input.expectedVersion,
          existing.version,
        );
      }

      const contentChanged =
        input.content !== undefined && input.content.trim() !== existing.content;
      const normalizedContentChanged =
        input.normalizedContent !== undefined &&
        (input.normalizedContent?.trim() ?? null) !==
          existing.normalizedContent;
      const semanticContentChanged =
        contentChanged || normalizedContentChanged;
      const embeddingModelChanged =
        input.embeddingModel !== undefined &&
        input.embeddingModel !== existing.embeddingModel;

      if (
        semanticContentChanged &&
        (input.embedding === undefined || input.embedding === null)
      ) {
        throw new StaleEmbeddingError(input.memoryId);
      }

      if (
        embeddingModelChanged &&
        input.embeddingModel !== null &&
        (input.embedding === undefined || input.embedding === null)
      ) {
        throw new StaleEmbeddingError(input.memoryId);
      }

      const nextValidFrom =
        input.validFrom === undefined ? existing.validFrom : input.validFrom;
      const nextValidTo =
        input.validTo === undefined ? existing.validTo : input.validTo;
      validateValidityWindow(nextValidFrom, nextValidTo);

      await transaction.memoryRevision.create({
        data: {
          memoryId: existing.id,
          version: existing.version,
          previousContent: existing.content,
          previousMetadata: toNullableJsonInput(existing.metadata),
          changeReason: input.changeReason ?? null,
          changedByRunId: input.changedByRunId ?? null,
        },
      });

      const updateResult = await transaction.memory.updateMany({
        where: {
          id: existing.id,
          agentId: input.agentId,
          agentUserId: input.agentUserId,
          status: MemoryStatus.ACTIVE,
          version: input.expectedVersion,
        },
        data: {
          ...(input.content === undefined
            ? {}
            : { content: input.content.trim() }),
          ...(input.normalizedContent === undefined
            ? {}
            : {
                normalizedContent: input.normalizedContent?.trim() ?? null,
              }),
          ...(input.metadata === undefined
            ? {}
            : { metadata: toNullableJsonInput(input.metadata) }),
          ...(input.embeddingModel === undefined
            ? {}
            : { embeddingModel: input.embeddingModel }),
          ...(input.importanceScore === undefined
            ? {}
            : { importanceScore: input.importanceScore }),
          ...(input.confidenceScore === undefined
            ? {}
            : { confidenceScore: input.confidenceScore }),
          ...(input.source === undefined ? {} : { source: input.source }),
          ...(input.validFrom === undefined
            ? {}
            : { validFrom: input.validFrom }),
          ...(input.validTo === undefined ? {} : { validTo: input.validTo }),
          ...(input.expiresAt === undefined
            ? {}
            : { expiresAt: input.expiresAt }),
          version: { increment: 1 },
        },
      });

      if (updateResult.count !== 1) {
        const current = await transaction.memory.findUnique({
          where: { id: input.memoryId },
          select: { version: true },
        });

        throw new MemoryVersionConflictError(
          input.memoryId,
          input.expectedVersion,
          current?.version ?? input.expectedVersion + 1,
        );
      }

      if (input.embedding !== undefined) {
        await this.setEmbedding(
          transaction,
          existing.id,
          input.embedding,
          input.embeddingModel === undefined
            ? existing.embeddingModel
            : input.embeddingModel,
        );
      }

      const updated = await transaction.memory.findUniqueOrThrow({
        where: { id: existing.id },
        select: memorySelect,
      });

      return toMemoryRecord(updated);
    });
  }

  public async softDelete(input: {
    readonly memoryId: string;
    readonly agentId: string;
    readonly agentUserId: string;
    readonly expectedVersion: number;
    readonly changedByRunId?: string | null;
    readonly reason?: string | null;
  }): Promise<MemoryRecord> {
    return this.prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
      const existing = await transaction.memory.findFirst({
        where: {
          id: input.memoryId,
          agentId: input.agentId,
          agentUserId: input.agentUserId,
          status: MemoryStatus.ACTIVE,
        },
        select: memorySelect,
      });

      if (existing === null) {
        throw new MemoryNotFoundError(input.memoryId);
      }

      if (existing.version !== input.expectedVersion) {
        throw new MemoryVersionConflictError(
          input.memoryId,
          input.expectedVersion,
          existing.version,
        );
      }

      await transaction.memoryRevision.create({
        data: {
          memoryId: existing.id,
          version: existing.version,
          previousContent: existing.content,
          previousMetadata: toNullableJsonInput(existing.metadata),
          changeReason: input.reason ?? "Soft deleted",
          changedByRunId: input.changedByRunId ?? null,
        },
      });

      const result = await transaction.memory.updateMany({
        where: {
          id: existing.id,
          agentId: input.agentId,
          agentUserId: input.agentUserId,
          status: MemoryStatus.ACTIVE,
          version: input.expectedVersion,
        },
        data: {
          status: MemoryStatus.DELETED,
          version: { increment: 1 },
        },
      });

      if (result.count !== 1) {
        throw new MemoryVersionConflictError(
          input.memoryId,
          input.expectedVersion,
          input.expectedVersion + 1,
        );
      }

      const deleted = await transaction.memory.findUniqueOrThrow({
        where: { id: existing.id },
        select: memorySelect,
      });

      return toMemoryRecord(deleted);
    });
  }

  public async markAccessed(input: {
    readonly memoryIds: readonly string[];
    readonly agentId: string;
    readonly agentUserId: string;
    readonly accessedAt?: Date;
  }): Promise<number> {
    const memoryIds = uniqueStrings(input.memoryIds);
    if (memoryIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.memory.updateMany({
      where: {
        id: { in: memoryIds },
        agentId: input.agentId,
        agentUserId: input.agentUserId,
        status: MemoryStatus.ACTIVE,
      },
      data: {
        lastAccessedAt: input.accessedAt ?? new Date(),
        accessCount: { increment: 1 },
      },
    });

    return result.count;
  }

  private validateEmbedding(embedding: readonly number[]): void {
    if (embedding.length !== this.embeddingDimensions) {
      throw new InvalidEmbeddingError(
        `Expected embedding dimension ${this.embeddingDimensions}, received ${embedding.length}.`,
      );
    }

    for (const value of embedding) {
      if (!Number.isFinite(value)) {
        throw new InvalidEmbeddingError(
          "Embedding values must all be finite numbers.",
        );
      }
    }
  }

  private toVectorLiteral(embedding: readonly number[]): string {
    this.validateEmbedding(embedding);
    return `[${embedding.join(",")}]`;
  }

  private async setEmbedding(
    transaction: Prisma.TransactionClient,
    memoryId: string,
    embedding: readonly number[] | null,
    embeddingModel: string | null,
  ): Promise<void> {
    if (embedding === null) {
      await transaction.$executeRaw`
        UPDATE "Memory"
        SET
          "embedding" = NULL,
          "embeddingModel" = ${embeddingModel}
        WHERE "id" = ${memoryId}
      `;
      return;
    }

    const vectorLiteral = this.toVectorLiteral(embedding);

    await transaction.$executeRaw`
      UPDATE "Memory"
      SET
        "embedding" = ${vectorLiteral}::vector,
        "embeddingModel" = ${embeddingModel}
      WHERE "id" = ${memoryId}
    `;
  }
}

function buildMemoryTypeClause(
  memoryTypes: readonly MemoryType[] | undefined,
): Prisma.Sql {
  if (memoryTypes === undefined || memoryTypes.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`
    AND m."memoryType" IN (${Prisma.join(
      memoryTypes.map(
        (memoryType) => Prisma.sql`${memoryType}::"MemoryType"`,
      ),
    )})
  `;
}

function toMemoryRecord(memory: SelectedMemory): MemoryRecord {
  return {
    ...memory,
    metadata: memory.metadata ?? null,
  };
}

function toNullableJsonInput(
  value: Prisma.InputJsonValue | Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullTypes.DbNull {
  return value === null || value === undefined
    ? Prisma.DbNull
    : (value as Prisma.InputJsonValue);
}

function normalizeCanonicalKey(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    throw new Error("canonicalKey cannot be empty.");
  }
  if (!/^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/.test(normalized)) {
    throw new Error(
      "canonicalKey must contain lowercase alphanumeric segments separated by ., _, :, or -.",
    );
  }
  return normalized;
}

function validateMemoryContent(content: string): void {
  if (content.trim().length === 0) {
    throw new Error("Memory content cannot be empty.");
  }
}

function validateScore(value: number, fieldName: string): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${fieldName} must be a finite number between 0 and 1.`);
  }
}

function validateValidityWindow(
  validFrom: Date | null,
  validTo: Date | null,
): void {
  if (validFrom !== null && validTo !== null && validFrom > validTo) {
    throw new Error("validFrom must be earlier than or equal to validTo.");
  }
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function clampLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(MAX_QUERY_LIMIT, Math.max(1, Math.floor(value)));
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}
