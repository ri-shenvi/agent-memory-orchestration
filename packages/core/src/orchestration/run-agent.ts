/**
 * Application service for one complete agent turn.
 *
 * This file intentionally depends on interfaces rather than concrete database,
 * provider, Redis, queue, or HTTP implementations. Wire the implementations in
 * the Next.js route handler or application composition root.
 */

export type RunStatus =
  | "QUEUED"
  | "RETRIEVING_MEMORY"
  | "GENERATING"
  | "EXECUTING_TOOLS"
  | "POST_PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type MemoryType =
  | "CONVERSATION_SUMMARY"
  | "USER_PREFERENCE"
  | "ENTITY"
  | "FACT"
  | "TASK"
  | "DECISION"
  | "TOOL_RESULT";

export interface RunAgentInput {
  readonly workspaceId: string;
  readonly agentId: string;
  readonly externalUserId: string;
  readonly conversationId?: string;
  readonly message: string;
  readonly requestId?: string;
  readonly idempotencyKey?: string;
  readonly options?: RunAgentOptions;
  readonly signal?: AbortSignal;
  readonly onProgress?: (event: PublicRunEvent) => void | Promise<void>;
}

export interface RunAgentOptions {
  readonly memory?: Partial<MemoryRunConfiguration>;
  readonly model?: string;
  readonly toolsEnabled?: boolean;
  readonly disabledToolNames?: readonly string[];
  readonly replayedFromRunId?: string;
}

export interface MemoryRunConfiguration {
  readonly enabled: boolean;
  readonly recentMessageLimit: number;
  readonly recentMessageTokenBudget: number;
  readonly semanticCandidateLimit: number;
  readonly importantCandidateLimit: number;
  readonly activeTypeCandidateLimit: number;
  readonly maxMemories: number;
  readonly contextTokenBudget: number;
  readonly minSemanticSimilarity: number;
  readonly recencyHalfLifeDays: number;
  readonly semanticWeight: number;
  readonly recencyWeight: number;
  readonly importanceWeight: number;
  readonly confidenceWeight: number;
  readonly typeBoostWeight: number;
  readonly includedMemoryTypes: readonly MemoryType[];
  readonly postProcessingFailureMode: "FAIL_RUN" | "COMPLETE_DEGRADED";
}

export interface EffectiveRunConfiguration {
  readonly memory: MemoryRunConfiguration;
  readonly model: string;
  readonly toolsEnabled: boolean;
  readonly disabledToolNames: readonly string[];
  readonly replayedFromRunId: string | null;
}

export interface AgentRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly systemPrompt: string;
  readonly provider: string;
  readonly protocol: "responses" | "chat-completions";
  readonly model: string;
  readonly baseUrl: string | null;
  readonly providerCredentialId: string | null;
  readonly enabled: boolean;
  readonly memoryEnabled: boolean;
  readonly memoryConfig: Readonly<Record<string, unknown>>;
}

export interface AgentUserRecord {
  readonly id: string;
  readonly workspaceId: string;
  readonly externalUserId: string;
}

export interface ConversationRecord {
  readonly id: string;
  readonly agentId: string;
  readonly agentUserId: string;
}

export interface MessageRecord {
  readonly id: string;
  readonly conversationId: string;
  readonly runId: string | null;
  readonly role: "SYSTEM" | "USER" | "ASSISTANT" | "TOOL";
  readonly content: string;
  readonly tokenCount: number | null;
  readonly createdAt: Date;
}

export interface AgentRunRecord {
  readonly id: string;
  readonly agentId: string;
  readonly agentUserId: string;
  readonly conversationId: string;
  readonly status: RunStatus;
}

export interface MemorySnapshot {
  readonly id: string;
  readonly memoryType: MemoryType;
  readonly canonicalKey: string | null;
  readonly content: string;
  readonly importanceScore: number;
  readonly confidenceScore: number;
  readonly updatedAt: Date;
  readonly expiresAt: Date | null;
}

export interface MemoryCandidate {
  readonly memory: MemorySnapshot;
  readonly rank: number;
  readonly semanticScore: number | null;
  readonly recencyScore: number;
  readonly importanceScore: number;
  readonly confidenceScore: number;
  readonly typeBoost: number;
  readonly finalScore: number;
  readonly reason: string;
  readonly includedInContext: boolean;
  readonly tokenCount: number;
  readonly candidateSources: readonly (
    | "SEMANTIC"
    | "HIGH_IMPORTANCE"
    | "ACTIVE_TYPE"
  )[];
}

export interface MemoryRetrievalResult {
  readonly recentMessages: readonly MessageRecord[];
  readonly candidates: readonly MemoryCandidate[];
  readonly selected: readonly MemoryCandidate[];
  readonly retrievalLatencyMs: number;
  readonly queryEmbeddingModel: string | null;
}

export interface ContextBuildResult {
  readonly text: string;
  readonly tokenCount: number;
  readonly includedMemoryIds: readonly string[];
}

export interface ToolDefinitionRecord {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly enabled: boolean;
}

export interface SanitizedToolExecution {
  readonly id: string;
  readonly toolDefinitionId: string;
  readonly toolName: string;
  readonly status: "SUCCEEDED" | "FAILED" | "BLOCKED";
  readonly executionTimeMs: number | null;
  readonly httpStatus: number | null;
  readonly sanitizedResultForModel: unknown;
}

export interface ModelUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export interface AgentLoopResult {
  readonly text: string;
  readonly usage: ModelUsage;
  readonly estimatedCostUsd: number | null;
  readonly modelLatencyMs: number;
  readonly toolLatencyMs: number;
  readonly toolExecutions: readonly SanitizedToolExecution[];
  readonly providerResponseId: string | null;
}

export interface MemoryMutationProposal {
  readonly action: "CREATE" | "UPDATE" | "EXPIRE" | "DELETE" | "NONE";
  readonly memoryType: Exclude<MemoryType, "CONVERSATION_SUMMARY">;
  readonly canonicalKey: string | null;
  readonly targetMemoryId: string | null;
  readonly content: string;
  readonly metadata: Readonly<Record<string, unknown>> | null;
  readonly importanceScore: number;
  readonly confidenceScore: number;
  readonly expiresAt: Date | null;
  readonly evidence: string;
}

export interface AppliedMemoryMutation {
  readonly action: "CREATED" | "UPDATED" | "EXPIRED" | "DELETED" | "IGNORED";
  readonly memoryId: string | null;
  readonly canonicalKey: string | null;
  readonly reason: string;
}

export interface MemoryConsolidationResult {
  readonly applied: readonly AppliedMemoryMutation[];
  readonly contradictionIds: readonly string[];
}

export interface RunAgentResult {
  readonly runId: string;
  readonly conversationId: string;
  readonly text: string;
  readonly memoriesUsed: readonly {
    readonly id: string;
    readonly type: MemoryType;
    readonly content: string;
    readonly finalScore: number;
    readonly reason: string;
  }[];
  readonly toolCalls: readonly {
    readonly id: string;
    readonly name: string;
    readonly status: "SUCCEEDED" | "FAILED" | "BLOCKED";
    readonly executionTimeMs: number | null;
  }[];
  readonly usage: ModelUsage & {
    readonly estimatedCostUsd: number | null;
  };
  readonly latency: {
    readonly retrievalMs: number;
    readonly modelMs: number;
    readonly toolMs: number;
    readonly postProcessingMs: number;
    readonly totalMs: number;
  };
  readonly warnings: readonly RunWarning[];
}

export interface RunWarning {
  readonly code: string;
  readonly message: string;
}

export interface PublicRunEvent {
  readonly runId: string;
  readonly type:
    | "run.created"
    | "memory.retrieval.started"
    | "memory.retrieval.completed"
    | "context.built"
    | "model.started"
    | "model.output.delta"
    | "tool.started"
    | "tool.completed"
    | "memory.post_processing.started"
    | "memory.post_processing.completed"
    | "memory.post_processing.degraded"
    | "run.completed"
    | "run.failed";
  readonly occurredAt: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export interface InternalRunEvent {
  readonly type: string;
  readonly sequence: number;
  readonly occurredAt: Date;
  readonly durationMs?: number;
  readonly payload?: Readonly<Record<string, unknown>>;
}

export interface AgentRepository {
  getRequired(input: {
    readonly workspaceId: string;
    readonly agentId: string;
  }): Promise<AgentRecord>;
}

export interface AgentUserRepository {
  getOrCreate(input: {
    readonly workspaceId: string;
    readonly externalUserId: string;
  }): Promise<AgentUserRecord>;
}

export interface ConversationRepository {
  getOrCreate(input: {
    readonly agentId: string;
    readonly agentUserId: string;
    readonly conversationId?: string;
  }): Promise<ConversationRecord>;
}

export interface MessageRepository {
  createUserMessage(input: {
    readonly conversationId: string;
    readonly runId: string;
    readonly content: string;
  }): Promise<MessageRecord>;

  createAssistantMessage(input: {
    readonly conversationId: string;
    readonly runId: string;
    readonly content: string;
    readonly tokenCount: number;
    readonly providerResponseId: string | null;
  }): Promise<MessageRecord>;
}

export interface RunRepository {
  findCompletedByIdempotencyKey(input: {
    readonly workspaceId: string;
    readonly agentId: string;
    readonly idempotencyKey: string;
  }): Promise<RunAgentResult | null>;

  create(input: {
    readonly agent: AgentRecord;
    readonly agentUser: AgentUserRecord;
    readonly conversation: ConversationRecord;
    readonly inputText: string;
    readonly configuration: EffectiveRunConfiguration;
    readonly requestId: string | null;
    readonly idempotencyKey: string | null;
  }): Promise<AgentRunRecord>;

  setStatus(runId: string, status: RunStatus): Promise<void>;

  appendEvent(runId: string, event: InternalRunEvent): Promise<void>;

  recordMemoryCandidates(input: {
    readonly runId: string;
    readonly candidates: readonly MemoryCandidate[];
  }): Promise<void>;

  saveContext(input: {
    readonly runId: string;
    readonly contextBlock: string;
    readonly contextTokenCount: number;
    readonly includedMemoryIds: readonly string[];
  }): Promise<void>;

  savePostProcessing(input: {
    readonly runId: string;
    readonly proposals: readonly MemoryMutationProposal[];
    readonly consolidation: MemoryConsolidationResult | null;
    readonly warning: RunWarning | null;
  }): Promise<void>;

  complete(input: {
    readonly runId: string;
    readonly outputText: string;
    readonly usage: ModelUsage;
    readonly estimatedCostUsd: number | null;
    readonly retrievalLatencyMs: number;
    readonly modelLatencyMs: number;
    readonly toolLatencyMs: number;
    readonly postProcessingLatencyMs: number;
    readonly totalLatencyMs: number;
    readonly warnings: readonly RunWarning[];
    readonly completedAt: Date;
    readonly sequence: number;
  }): Promise<void>;

  fail(input: {
    readonly runId: string;
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly totalLatencyMs: number;
    readonly failedAt: Date;
    readonly sequence: number;
  }): Promise<void>;
}

export interface MemoryOrchestrator {
  retrieve(input: {
    readonly agent: AgentRecord;
    readonly agentUser: AgentUserRecord;
    readonly conversation: ConversationRecord;
    readonly userMessage: MessageRecord;
    readonly query: string;
    readonly configuration: MemoryRunConfiguration;
    readonly signal?: AbortSignal;
  }): Promise<MemoryRetrievalResult>;
}

export interface ContextBuilder {
  build(input: {
    readonly externalUserId: string;
    readonly generatedAt: Date;
    readonly selectedMemories: readonly MemoryCandidate[];
    readonly configuration: MemoryRunConfiguration;
  }): Promise<ContextBuildResult> | ContextBuildResult;
}

export interface ToolRepository {
  getEnabledForAgent(input: {
    readonly agentId: string;
    readonly disabledToolNames: readonly string[];
  }): Promise<readonly ToolDefinitionRecord[]>;
}

export interface ModelProvider {
  readonly providerName: string;
}

export interface ProviderFactory {
  create(input: {
    readonly agent: AgentRecord;
    readonly modelOverride: string;
  }): Promise<ModelProvider>;
}

export type AgentLoopEvent =
  | {
      readonly type: "model.output.delta";
      readonly delta: string;
    }
  | {
      readonly type: "tool.started";
      readonly toolName: string;
      readonly toolExecutionId: string;
    }
  | {
      readonly type: "tool.completed";
      readonly execution: SanitizedToolExecution;
    }
  | {
      readonly type: "status";
      readonly status: "GENERATING" | "EXECUTING_TOOLS";
    };

export interface AgentLoop {
  /**
   * The implementation must durably persist every tool attempt before emitting
   * `tool.completed`. Event payloads and returned results must already be
   * sanitized and must not include credentials or unredacted headers.
   */
  execute(input: {
    readonly runId: string;
    readonly provider: ModelProvider;
    readonly model: string;
    readonly systemPrompt: string;
    readonly memoryContext: string;
    readonly recentMessages: readonly MessageRecord[];
    readonly currentUserMessage: string;
    readonly tools: readonly ToolDefinitionRecord[];
    readonly signal?: AbortSignal;
    readonly onEvent: (event: AgentLoopEvent) => Promise<void>;
  }): Promise<AgentLoopResult>;
}

export interface MemoryExtractor {
  extract(input: {
    readonly agent: AgentRecord;
    readonly agentUser: AgentUserRecord;
    readonly conversation: ConversationRecord;
    readonly runId: string;
    readonly userMessage: MessageRecord;
    readonly assistantMessage: MessageRecord;
    readonly selectedMemories: readonly MemoryCandidate[];
    readonly toolExecutions: readonly SanitizedToolExecution[];
    readonly signal?: AbortSignal;
  }): Promise<readonly MemoryMutationProposal[]>;
}

export interface MemoryConsolidator {
  apply(input: {
    readonly runId: string;
    readonly agentId: string;
    readonly agentUserId: string;
    readonly sourceMessageId: string;
    readonly proposals: readonly MemoryMutationProposal[];
  }): Promise<MemoryConsolidationResult>;
}

export interface MemoryAccessRepository {
  markAccessed(input: {
    readonly memoryIds: readonly string[];
    readonly agentId: string;
    readonly agentUserId: string;
    readonly accessedAt: Date;
  }): Promise<number>;
}

export interface RunConfigurationResolver {
  resolve(input: {
    readonly agent: AgentRecord;
    readonly options?: RunAgentOptions;
  }): EffectiveRunConfiguration;
}

export interface ConversationLock {
  withLock<T>(input: {
    readonly key: string;
    readonly signal?: AbortSignal;
    readonly task: () => Promise<T>;
  }): Promise<T>;
}

export interface MaintenanceQueue {
  enqueueConversationMaintenance(input: {
    readonly conversationId: string;
    readonly agentId: string;
    readonly agentUserId: string;
    readonly completedRunId: string;
  }): Promise<void>;
}

export interface Clock {
  now(): Date;
  monotonicMs(): number;
}

export interface ErrorNormalizer {
  normalize(error: unknown): {
    readonly code: string;
    readonly safeMessage: string;
  };
}

export interface Logger {
  warn(message: string, metadata?: Readonly<Record<string, unknown>>): void;
  error(message: string, metadata?: Readonly<Record<string, unknown>>): void;
}

export interface RunAgentDependencies {
  readonly agentRepository: AgentRepository;
  readonly agentUserRepository: AgentUserRepository;
  readonly conversationRepository: ConversationRepository;
  readonly messageRepository: MessageRepository;
  readonly runRepository: RunRepository;
  readonly memoryOrchestrator: MemoryOrchestrator;
  readonly contextBuilder: ContextBuilder;
  readonly toolRepository: ToolRepository;
  readonly providerFactory: ProviderFactory;
  readonly agentLoop: AgentLoop;
  readonly memoryExtractor: MemoryExtractor;
  readonly memoryConsolidator: MemoryConsolidator;
  readonly memoryAccessRepository: MemoryAccessRepository;
  readonly configurationResolver: RunConfigurationResolver;
  readonly conversationLock: ConversationLock;
  readonly maintenanceQueue: MaintenanceQueue;
  readonly clock: Clock;
  readonly errorNormalizer: ErrorNormalizer;
  readonly logger: Logger;
}

export class AgentDisabledError extends Error {
  public readonly code = "AGENT_DISABLED";

  public constructor(agentId: string) {
    super(`Agent ${agentId} is disabled.`);
    this.name = "AgentDisabledError";
  }
}

export class InvalidRunInputError extends Error {
  public readonly code = "INVALID_RUN_INPUT";

  public constructor(message: string) {
    super(message);
    this.name = "InvalidRunInputError";
  }
}

export class AgentRunFailedError extends Error {
  public constructor(
    public readonly runId: string,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AgentRunFailedError";
  }
}

/**
 * Executes one user turn and returns only sanitized, public-safe data.
 */
export class RunAgentService {
  public constructor(private readonly dependencies: RunAgentDependencies) {}

  public async run(input: RunAgentInput): Promise<RunAgentResult> {
    validateRunInput(input);

    if (input.idempotencyKey !== undefined) {
      const existing =
        await this.dependencies.runRepository.findCompletedByIdempotencyKey({
          workspaceId: input.workspaceId,
          agentId: input.agentId,
          idempotencyKey: input.idempotencyKey,
        });

      if (existing !== null) {
        return existing;
      }
    }

    const lockKey = buildConversationLockKey(input);

    return this.dependencies.conversationLock.withLock({
      key: lockKey,
      signal: input.signal,
      task: () => this.runInsideLock(input),
    });
  }

  private async runInsideLock(input: RunAgentInput): Promise<RunAgentResult> {
    const startedAtMs = this.dependencies.clock.monotonicMs();
    const agent = await this.dependencies.agentRepository.getRequired({
      workspaceId: input.workspaceId,
      agentId: input.agentId,
    });

    if (!agent.enabled) {
      throw new AgentDisabledError(agent.id);
    }

    const configuration = this.dependencies.configurationResolver.resolve({
      agent,
      options: input.options,
    });

    const agentUser =
      await this.dependencies.agentUserRepository.getOrCreate({
        workspaceId: input.workspaceId,
        externalUserId: input.externalUserId,
      });

    const conversation =
      await this.dependencies.conversationRepository.getOrCreate({
        agentId: agent.id,
        agentUserId: agentUser.id,
        conversationId: input.conversationId,
      });

    const run = await this.dependencies.runRepository.create({
      agent,
      agentUser,
      conversation,
      inputText: input.message,
      configuration,
      requestId: input.requestId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
    });

    let sequence = 0;
    let terminal = false;

    const emit = async (
      type: PublicRunEvent["type"] | string,
      payload: Readonly<Record<string, unknown>> = {},
      durationMs?: number,
    ): Promise<void> => {
      sequence += 1;
      const occurredAt = this.dependencies.clock.now();

      await this.dependencies.runRepository.appendEvent(run.id, {
        type,
        sequence,
        occurredAt,
        ...(durationMs === undefined ? {} : { durationMs }),
        payload,
      });

      if (isPublicRunEventType(type)) {
        await safelyPublishProgress(
          input.onProgress,
          {
            runId: run.id,
            type,
            occurredAt: occurredAt.toISOString(),
            data: payload,
          },
          this.dependencies.logger,
        );
      }
    };

    try {
      await emit("run.created", {
        conversationId: conversation.id,
        agentId: agent.id,
        model: configuration.model,
        memoryEnabled: configuration.memory.enabled,
      });

      const userMessage =
        await this.dependencies.messageRepository.createUserMessage({
          conversationId: conversation.id,
          runId: run.id,
          content: input.message,
        });

      await emit("message.user.persisted", {
        messageId: userMessage.id,
      });

      await this.dependencies.runRepository.setStatus(
        run.id,
        "RETRIEVING_MEMORY",
      );
      await emit("memory.retrieval.started", {
        enabled: configuration.memory.enabled,
      });

      const retrievalStartedAtMs = this.dependencies.clock.monotonicMs();
      const retrieval = await this.dependencies.memoryOrchestrator.retrieve({
        agent,
        agentUser,
        conversation,
        userMessage,
        query: input.message,
        configuration: configuration.memory,
        signal: input.signal,
      });
      const measuredRetrievalLatencyMs = elapsedMs(
        retrievalStartedAtMs,
        this.dependencies.clock.monotonicMs(),
      );
      const retrievalLatencyMs = measuredRetrievalLatencyMs;

      await this.dependencies.runRepository.recordMemoryCandidates({
        runId: run.id,
        candidates: retrieval.candidates,
      });

      await emit(
        "memory.retrieval.completed",
        {
          candidateCount: retrieval.candidates.length,
          selectedCount: retrieval.selected.length,
          queryEmbeddingModel: retrieval.queryEmbeddingModel,
        },
        retrievalLatencyMs,
      );

      const context = await this.dependencies.contextBuilder.build({
        externalUserId: agentUser.externalUserId,
        generatedAt: this.dependencies.clock.now(),
        selectedMemories: retrieval.selected,
        configuration: configuration.memory,
      });

      assertContextMatchesSelection(context, retrieval.selected);

      await this.dependencies.runRepository.saveContext({
        runId: run.id,
        contextBlock: context.text,
        contextTokenCount: context.tokenCount,
        includedMemoryIds: context.includedMemoryIds,
      });

      await emit("context.built", {
        memoryCount: context.includedMemoryIds.length,
        tokenCount: context.tokenCount,
      });

      const tools = configuration.toolsEnabled
        ? await this.dependencies.toolRepository.getEnabledForAgent({
            agentId: agent.id,
            disabledToolNames: configuration.disabledToolNames,
          })
        : [];

      const provider = await this.dependencies.providerFactory.create({
        agent,
        modelOverride: configuration.model,
      });

      await this.dependencies.runRepository.setStatus(run.id, "GENERATING");
      await emit("model.started", {
        provider: provider.providerName,
        model: configuration.model,
        toolCount: tools.length,
      });

      const generation = await this.dependencies.agentLoop.execute({
        runId: run.id,
        provider,
        model: configuration.model,
        systemPrompt: agent.systemPrompt,
        memoryContext: context.text,
        recentMessages: retrieval.recentMessages,
        currentUserMessage: input.message,
        tools,
        signal: input.signal,
        onEvent: async (event) => {
          switch (event.type) {
            case "status": {
              await this.dependencies.runRepository.setStatus(
                run.id,
                event.status,
              );
              return;
            }
            case "model.output.delta": {
              await safelyPublishProgress(
                input.onProgress,
                {
                  runId: run.id,
                  type: "model.output.delta",
                  occurredAt: this.dependencies.clock.now().toISOString(),
                  data: { delta: event.delta },
                },
                this.dependencies.logger,
              );
              return;
            }
            case "tool.started": {
              await emit("tool.started", {
                toolName: event.toolName,
                toolExecutionId: event.toolExecutionId,
              });
              return;
            }
            case "tool.completed": {
              await emit("tool.completed", {
                toolName: event.execution.toolName,
                toolExecutionId: event.execution.id,
                status: event.execution.status,
                executionTimeMs: event.execution.executionTimeMs,
                httpStatus: event.execution.httpStatus,
              });
              return;
            }
            default: {
              return assertNever(event);
            }
          }
        },
      });

      const assistantMessage =
        await this.dependencies.messageRepository.createAssistantMessage({
          conversationId: conversation.id,
          runId: run.id,
          content: generation.text,
          tokenCount: generation.usage.outputTokens,
          providerResponseId: generation.providerResponseId,
        });

      await emit("message.assistant.persisted", {
        messageId: assistantMessage.id,
      });

      const includedMemoryIds = context.includedMemoryIds;
      if (includedMemoryIds.length > 0) {
        await this.dependencies.memoryAccessRepository.markAccessed({
          memoryIds: includedMemoryIds,
          agentId: agent.id,
          agentUserId: agentUser.id,
          accessedAt: this.dependencies.clock.now(),
        });
      }

      await this.dependencies.runRepository.setStatus(
        run.id,
        "POST_PROCESSING",
      );
      await emit("memory.post_processing.started", {
        enabled: configuration.memory.enabled,
      });

      const postProcessingStartedAtMs =
        this.dependencies.clock.monotonicMs();
      const warnings: RunWarning[] = [];
      let proposals: readonly MemoryMutationProposal[] = [];
      let consolidation: MemoryConsolidationResult | null = null;

      if (configuration.memory.enabled) {
        try {
          proposals = await this.dependencies.memoryExtractor.extract({
            agent,
            agentUser,
            conversation,
            runId: run.id,
            userMessage,
            assistantMessage,
            selectedMemories: retrieval.selected,
            toolExecutions: generation.toolExecutions,
            signal: input.signal,
          });

          consolidation = await this.dependencies.memoryConsolidator.apply({
            runId: run.id,
            agentId: agent.id,
            agentUserId: agentUser.id,
            sourceMessageId: userMessage.id,
            proposals,
          });

          await this.dependencies.runRepository.savePostProcessing({
            runId: run.id,
            proposals,
            consolidation,
            warning: null,
          });

          await emit("memory.post_processing.completed", {
            proposalCount: proposals.length,
            appliedCount: consolidation.applied.length,
            contradictionCount: consolidation.contradictionIds.length,
          });
        } catch (error) {
          if (
            configuration.memory.postProcessingFailureMode === "FAIL_RUN"
          ) {
            throw error;
          }

          const normalized = this.dependencies.errorNormalizer.normalize(error);
          const warning: RunWarning = {
            code: "MEMORY_POST_PROCESSING_DEGRADED",
            message:
              "The response completed, but memory extraction or consolidation did not finish successfully.",
          };
          warnings.push(warning);

          await this.dependencies.runRepository.savePostProcessing({
            runId: run.id,
            proposals,
            consolidation: null,
            warning,
          });

          await emit("memory.post_processing.degraded", {
            warningCode: warning.code,
            internalErrorCode: normalized.code,
          });

          this.dependencies.logger.warn(
            "Memory post-processing completed in degraded mode.",
            {
              runId: run.id,
              errorCode: normalized.code,
            },
          );
        }
      } else {
        await this.dependencies.runRepository.savePostProcessing({
          runId: run.id,
          proposals: [],
          consolidation: {
            applied: [],
            contradictionIds: [],
          },
          warning: null,
        });

        await emit("memory.post_processing.completed", {
          proposalCount: 0,
          appliedCount: 0,
          contradictionCount: 0,
          skipped: true,
        });
      }

      const postProcessingLatencyMs = elapsedMs(
        postProcessingStartedAtMs,
        this.dependencies.clock.monotonicMs(),
      );
      const totalLatencyMs = elapsedMs(
        startedAtMs,
        this.dependencies.clock.monotonicMs(),
      );
      const completedAt = this.dependencies.clock.now();

      sequence += 1;
      await this.dependencies.runRepository.complete({
        runId: run.id,
        outputText: generation.text,
        usage: generation.usage,
        estimatedCostUsd: generation.estimatedCostUsd,
        retrievalLatencyMs,
        modelLatencyMs: generation.modelLatencyMs,
        toolLatencyMs: generation.toolLatencyMs,
        postProcessingLatencyMs,
        totalLatencyMs,
        warnings,
        completedAt,
        sequence,
      });
      terminal = true;

      await safelyPublishProgress(
        input.onProgress,
        {
          runId: run.id,
          type: "run.completed",
          occurredAt: completedAt.toISOString(),
          data: {
            totalLatencyMs,
            totalTokens: generation.usage.totalTokens,
            estimatedCostUsd: generation.estimatedCostUsd,
            warningCount: warnings.length,
          },
        },
        this.dependencies.logger,
      );

      const result: RunAgentResult = {
        runId: run.id,
        conversationId: conversation.id,
        text: generation.text,
        memoriesUsed: retrieval.selected.map((candidate) => ({
          id: candidate.memory.id,
          type: candidate.memory.memoryType,
          content: candidate.memory.content,
          finalScore: candidate.finalScore,
          reason: candidate.reason,
        })),
        toolCalls: generation.toolExecutions.map((execution) => ({
          id: execution.id,
          name: execution.toolName,
          status: execution.status,
          executionTimeMs: execution.executionTimeMs,
        })),
        usage: {
          ...generation.usage,
          estimatedCostUsd: generation.estimatedCostUsd,
        },
        latency: {
          retrievalMs: retrievalLatencyMs,
          modelMs: generation.modelLatencyMs,
          toolMs: generation.toolLatencyMs,
          postProcessingMs: postProcessingLatencyMs,
          totalMs: totalLatencyMs,
        },
        warnings,
      };

      await this.enqueueMaintenanceBestEffort({
        conversation,
        agent,
        agentUser,
        run,
        sequence,
      });

      return result;
    } catch (error) {
      const normalized = this.dependencies.errorNormalizer.normalize(error);
      const totalLatencyMs = elapsedMs(
        startedAtMs,
        this.dependencies.clock.monotonicMs(),
      );

      if (!terminal) {
        try {
          sequence += 1;
          await this.dependencies.runRepository.fail({
            runId: run.id,
            errorCode: normalized.code,
            errorMessage: normalized.safeMessage,
            totalLatencyMs,
            failedAt: this.dependencies.clock.now(),
            sequence,
          });

          await safelyPublishProgress(
            input.onProgress,
            {
              runId: run.id,
              type: "run.failed",
              occurredAt: this.dependencies.clock.now().toISOString(),
              data: {
                code: normalized.code,
                message: normalized.safeMessage,
              },
            },
            this.dependencies.logger,
          );
        } catch (persistenceError) {
          const persistenceFailure =
            this.dependencies.errorNormalizer.normalize(persistenceError);
          this.dependencies.logger.error(
            "Failed to persist terminal agent-run failure state.",
            {
              runId: run.id,
              originalErrorCode: normalized.code,
              persistenceErrorCode: persistenceFailure.code,
            },
          );
        }
      }

      throw new AgentRunFailedError(
        run.id,
        normalized.code,
        normalized.safeMessage,
      );
    }
  }

  private async enqueueMaintenanceBestEffort(input: {
    readonly conversation: ConversationRecord;
    readonly agent: AgentRecord;
    readonly agentUser: AgentUserRecord;
    readonly run: AgentRunRecord;
    readonly sequence: number;
  }): Promise<void> {
    try {
      await this.dependencies.maintenanceQueue.enqueueConversationMaintenance({
        conversationId: input.conversation.id,
        agentId: input.agent.id,
        agentUserId: input.agentUser.id,
        completedRunId: input.run.id,
      });

      await this.dependencies.runRepository.appendEvent(input.run.id, {
        type: "maintenance.enqueued",
        sequence: input.sequence + 1,
        occurredAt: this.dependencies.clock.now(),
        payload: {},
      });
    } catch (error) {
      const normalized = this.dependencies.errorNormalizer.normalize(error);

      this.dependencies.logger.warn(
        "Agent run completed, but maintenance enqueueing failed.",
        {
          runId: input.run.id,
          errorCode: normalized.code,
        },
      );

      try {
        await this.dependencies.runRepository.appendEvent(input.run.id, {
          type: "maintenance.enqueue_failed",
          sequence: input.sequence + 1,
          occurredAt: this.dependencies.clock.now(),
          payload: { errorCode: normalized.code },
        });
      } catch (traceError) {
        const traceFailure = this.dependencies.errorNormalizer.normalize(
          traceError,
        );
        this.dependencies.logger.warn(
          "Failed to append the maintenance enqueue failure event.",
          {
            runId: input.run.id,
            errorCode: traceFailure.code,
          },
        );
      }
    }
  }
}

function validateRunInput(input: RunAgentInput): void {
  if (input.workspaceId.trim().length === 0) {
    throw new InvalidRunInputError("workspaceId is required.");
  }
  if (input.agentId.trim().length === 0) {
    throw new InvalidRunInputError("agentId is required.");
  }
  if (input.externalUserId.trim().length === 0) {
    throw new InvalidRunInputError("externalUserId is required.");
  }
  if (input.message.trim().length === 0) {
    throw new InvalidRunInputError("message cannot be empty.");
  }
  if (input.message.length > 100_000) {
    throw new InvalidRunInputError("message exceeds the maximum length.");
  }
  if (
    input.idempotencyKey !== undefined &&
    input.idempotencyKey.trim().length === 0
  ) {
    throw new InvalidRunInputError(
      "idempotencyKey cannot be empty when provided.",
    );
  }
}

function buildConversationLockKey(input: RunAgentInput): string {
  return [
    "agent-run",
    safeLockSegment(input.workspaceId),
    safeLockSegment(input.agentId),
    safeLockSegment(input.conversationId ?? input.externalUserId),
  ].join(":");
}

function safeLockSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

function elapsedMs(startedAtMs: number, endedAtMs: number): number {
  return Math.max(0, Math.round(endedAtMs - startedAtMs));
}

function assertContextMatchesSelection(
  context: ContextBuildResult,
  selected: readonly MemoryCandidate[],
): void {
  const selectedIds = new Set(
    selected
      .filter((candidate) => candidate.includedInContext)
      .map((candidate) => candidate.memory.id),
  );
  const contextIds = new Set(context.includedMemoryIds);

  if (selectedIds.size !== contextIds.size) {
    throw new Error(
      "Context builder included-memory IDs do not match retrieval selection.",
    );
  }

  for (const id of selectedIds) {
    if (!contextIds.has(id)) {
      throw new Error(
        "Context builder included-memory IDs do not match retrieval selection.",
      );
    }
  }
}

async function safelyPublishProgress(
  publisher: RunAgentInput["onProgress"],
  event: PublicRunEvent,
  logger: Logger,
): Promise<void> {
  if (publisher === undefined) {
    return;
  }

  try {
    await publisher(event);
  } catch (error) {
    logger.warn("Run progress subscriber failed; continuing the run.", {
      runId: event.runId,
      eventType: event.type,
      subscriberError:
        error instanceof Error ? error.name : "UNKNOWN_SUBSCRIBER_ERROR",
    });
  }
}

function isPublicRunEventType(
  type: string,
): type is PublicRunEvent["type"] {
  return PUBLIC_RUN_EVENT_TYPES.has(type as PublicRunEvent["type"]);
}

const PUBLIC_RUN_EVENT_TYPES = new Set<PublicRunEvent["type"]>([
  "run.created",
  "memory.retrieval.started",
  "memory.retrieval.completed",
  "context.built",
  "model.started",
  "model.output.delta",
  "tool.started",
  "tool.completed",
  "memory.post_processing.started",
  "memory.post_processing.completed",
  "memory.post_processing.degraded",
  "run.completed",
  "run.failed",
]);

function assertNever(value: never): never {
  throw new Error(`Unhandled agent-loop event: ${JSON.stringify(value)}`);
}
