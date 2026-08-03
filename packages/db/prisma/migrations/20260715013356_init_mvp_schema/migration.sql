-- Enable pgvector before creating the fixed-dimension embedding column.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "MemoryType" AS ENUM ('CONVERSATION_SUMMARY', 'USER_PREFERENCE', 'ENTITY', 'FACT', 'TASK', 'DECISION', 'TOOL_RESULT');

-- CreateEnum
CREATE TYPE "MemoryStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'CONTRADICTED', 'EXPIRED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('SYSTEM', 'USER', 'ASSISTANT', 'TOOL');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RETRIEVING_MEMORY', 'GENERATING', 'EXECUTING_TOOLS', 'POST_PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ToolExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'ERROR');

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppApiKey" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "encryptionKeyVersion" INTEGER NOT NULL,
    "lastFour" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "providerCredentialId" TEXT,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "systemPrompt" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "protocol" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "temperature" DOUBLE PRECISION,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "memoryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "memoryConfig" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentUser" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "displayName" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "runId" TEXT,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "providerId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Memory" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "sourceMessageId" TEXT,
    "memoryType" "MemoryType" NOT NULL,
    "canonicalKey" TEXT,
    "content" TEXT NOT NULL,
    "normalizedContent" TEXT,
    "metadata" JSONB,
    "embedding" vector(1536),
    "embeddingModel" TEXT,
    "importanceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" "MemoryStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "accessCount" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Memory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryRevision" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "previousContent" TEXT NOT NULL,
    "previousNormalizedContent" TEXT,
    "previousMetadata" JSONB,
    "previousImportanceScore" DOUBLE PRECISION NOT NULL,
    "previousConfidenceScore" DOUBLE PRECISION NOT NULL,
    "changeReason" TEXT,
    "changedByRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contradiction" (
    "id" TEXT NOT NULL,
    "leftMemoryId" TEXT NOT NULL,
    "rightMemoryId" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contradiction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentUserId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "replayedFromRunId" TEXT,
    "requestId" TEXT,
    "idempotencyKey" TEXT,
    "pricingVersion" TEXT,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "inputText" TEXT NOT NULL,
    "outputText" TEXT,
    "contextBlock" TEXT,
    "contextTokenCount" INTEGER,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "effectiveConfig" JSONB NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(14,8),
    "retrievalLatencyMs" INTEGER,
    "modelLatencyMs" INTEGER,
    "toolLatencyMs" INTEGER,
    "postProcessingLatencyMs" INTEGER,
    "totalLatencyMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunMemory" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "semanticScore" DOUBLE PRECISION NOT NULL,
    "recencyScore" DOUBLE PRECISION NOT NULL,
    "importanceScore" DOUBLE PRECISION NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "typeBoost" DOUBLE PRECISION NOT NULL,
    "finalScore" DOUBLE PRECISION NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "includedInContext" BOOLEAN NOT NULL DEFAULT false,
    "estimatedTokenCount" INTEGER NOT NULL,

    CONSTRAINT "RunMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunEvent" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "durationMs" INTEGER,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolDefinition" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "method" "HttpMethod" NOT NULL,
    "endpoint" TEXT NOT NULL,
    "headerTemplate" JSONB,
    "authConfig" JSONB,
    "requestSchema" JSONB NOT NULL,
    "responseSchema" JSONB,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToolDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToolExecution" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "toolDefinitionId" TEXT NOT NULL,
    "status" "ToolExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "requestArguments" JSONB NOT NULL,
    "sanitizedRequest" JSONB,
    "sanitizedResponse" JSONB,
    "httpStatus" INTEGER,
    "executionTimeMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToolExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCase" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "setupMessages" JSONB NOT NULL,
    "triggerMessage" TEXT NOT NULL,
    "assertions" JSONB NOT NULL,
    "effectiveConfig" JSONB,
    "expectedBehavior" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EvaluationCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationRun" (
    "id" TEXT NOT NULL,
    "evaluationCaseId" TEXT NOT NULL,
    "agentRunId" TEXT,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "effectiveConfig" JSONB NOT NULL,
    "expectedBehavior" JSONB NOT NULL,
    "actualBehavior" JSONB,
    "assertionResults" JSONB,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(14,8),
    "latencyMs" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,

    CONSTRAINT "EvaluationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemoOrder" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "externalUserId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "estimatedDeliveryAt" TIMESTAMP(3) NOT NULL,
    "deliveryLocation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DemoOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_name_idx" ON "Workspace"("name");

-- CreateIndex
CREATE INDEX "app_api_key_workspace_idx" ON "AppApiKey"("workspaceId");

-- CreateIndex
CREATE INDEX "app_api_key_prefix_idx" ON "AppApiKey"("keyPrefix");

-- CreateIndex
CREATE INDEX "app_api_key_expiration_idx" ON "AppApiKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "app_api_key_workspace_name_key" ON "AppApiKey"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "credential_workspace_idx" ON "Credential"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "credential_workspace_name_key" ON "Credential"("workspaceId", "name");

-- CreateIndex
CREATE INDEX "agent_workspace_idx" ON "Agent"("workspaceId");

-- CreateIndex
CREATE INDEX "agent_credential_idx" ON "Agent"("providerCredentialId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_workspace_slug_key" ON "Agent"("workspaceId", "slug");

-- CreateIndex
CREATE INDEX "agent_user_workspace_idx" ON "AgentUser"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_user_workspace_external_id_key" ON "AgentUser"("workspaceId", "externalUserId");

-- CreateIndex
CREATE INDEX "conversation_agent_user_updated_idx" ON "Conversation"("agentId", "agentUserId", "updatedAt");

-- CreateIndex
CREATE INDEX "conversation_agent_user_idx" ON "Conversation"("agentUserId");

-- CreateIndex
CREATE INDEX "message_conversation_created_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "message_run_idx" ON "Message"("runId");

-- CreateIndex
CREATE INDEX "memory_owner_status_idx" ON "Memory"("agentId", "agentUserId", "status");

-- CreateIndex
CREATE INDEX "memory_agent_user_idx" ON "Memory"("agentUserId");

-- CreateIndex
CREATE INDEX "memory_source_message_idx" ON "Memory"("sourceMessageId");

-- CreateIndex
CREATE INDEX "memory_expiration_scan_idx" ON "Memory"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "memory_importance_lookup_idx" ON "Memory"("agentId", "agentUserId", "importanceScore");

-- CreateIndex
CREATE INDEX "memory_revision_run_idx" ON "MemoryRevision"("changedByRunId");

-- CreateIndex
CREATE UNIQUE INDEX "memory_revision_memory_version_key" ON "MemoryRevision"("memoryId", "version");

-- CreateIndex
CREATE INDEX "contradiction_right_memory_idx" ON "Contradiction"("rightMemoryId");

-- CreateIndex
CREATE INDEX "contradiction_resolved_run_idx" ON "Contradiction"("resolvedByRunId");

-- CreateIndex
CREATE UNIQUE INDEX "contradiction_memory_pair_key" ON "Contradiction"("leftMemoryId", "rightMemoryId");

-- CreateIndex
CREATE INDEX "agent_run_agent_started_idx" ON "AgentRun"("agentId", "startedAt");

-- CreateIndex
CREATE INDEX "agent_run_user_started_idx" ON "AgentRun"("agentUserId", "startedAt");

-- CreateIndex
CREATE INDEX "agent_run_conversation_started_idx" ON "AgentRun"("conversationId", "startedAt");

-- CreateIndex
CREATE INDEX "agent_run_replay_parent_idx" ON "AgentRun"("replayedFromRunId");

-- CreateIndex
CREATE INDEX "agent_run_request_idx" ON "AgentRun"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_run_agent_idempotency_key" ON "AgentRun"("agentId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "run_memory_run_rank_idx" ON "RunMemory"("runId", "rank");

-- CreateIndex
CREATE INDEX "run_memory_memory_idx" ON "RunMemory"("memoryId");

-- CreateIndex
CREATE UNIQUE INDEX "run_memory_run_memory_key" ON "RunMemory"("runId", "memoryId");

-- CreateIndex
CREATE INDEX "run_event_run_sequence_idx" ON "RunEvent"("runId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "run_event_run_sequence_key" ON "RunEvent"("runId", "sequence");

-- CreateIndex
CREATE INDEX "tool_definition_agent_idx" ON "ToolDefinition"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "tool_definition_agent_name_key" ON "ToolDefinition"("agentId", "name");

-- CreateIndex
CREATE INDEX "tool_execution_run_idx" ON "ToolExecution"("runId");

-- CreateIndex
CREATE INDEX "tool_execution_definition_idx" ON "ToolExecution"("toolDefinitionId");

-- CreateIndex
CREATE INDEX "evaluation_case_agent_idx" ON "EvaluationCase"("agentId");

-- CreateIndex
CREATE UNIQUE INDEX "evaluation_case_agent_name_key" ON "EvaluationCase"("agentId", "name");

-- CreateIndex
CREATE INDEX "evaluation_run_case_started_idx" ON "EvaluationRun"("evaluationCaseId", "startedAt");

-- CreateIndex
CREATE INDEX "evaluation_run_agent_run_idx" ON "EvaluationRun"("agentRunId");

-- CreateIndex
CREATE INDEX "demo_order_workspace_user_idx" ON "DemoOrder"("workspaceId", "externalUserId");

-- CreateIndex
CREATE UNIQUE INDEX "demo_order_workspace_order_number_key" ON "DemoOrder"("workspaceId", "orderNumber");

-- AddForeignKey
ALTER TABLE "AppApiKey" ADD CONSTRAINT "AppApiKey_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_providerCredentialId_fkey" FOREIGN KEY ("providerCredentialId") REFERENCES "Credential"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentUser" ADD CONSTRAINT "AgentUser_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "AgentUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "AgentUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Memory" ADD CONSTRAINT "Memory_sourceMessageId_fkey" FOREIGN KEY ("sourceMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRevision" ADD CONSTRAINT "MemoryRevision_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemoryRevision" ADD CONSTRAINT "MemoryRevision_changedByRunId_fkey" FOREIGN KEY ("changedByRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contradiction" ADD CONSTRAINT "Contradiction_leftMemoryId_fkey" FOREIGN KEY ("leftMemoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contradiction" ADD CONSTRAINT "Contradiction_rightMemoryId_fkey" FOREIGN KEY ("rightMemoryId") REFERENCES "Memory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contradiction" ADD CONSTRAINT "Contradiction_resolvedByRunId_fkey" FOREIGN KEY ("resolvedByRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_agentUserId_fkey" FOREIGN KEY ("agentUserId") REFERENCES "AgentUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentRun" ADD CONSTRAINT "AgentRun_replayedFromRunId_fkey" FOREIGN KEY ("replayedFromRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunMemory" ADD CONSTRAINT "RunMemory_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunMemory" ADD CONSTRAINT "RunMemory_memoryId_fkey" FOREIGN KEY ("memoryId") REFERENCES "Memory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunEvent" ADD CONSTRAINT "RunEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolDefinition" ADD CONSTRAINT "ToolDefinition_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AgentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToolExecution" ADD CONSTRAINT "ToolExecution_toolDefinitionId_fkey" FOREIGN KEY ("toolDefinitionId") REFERENCES "ToolDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCase" ADD CONSTRAINT "EvaluationCase_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_evaluationCaseId_fkey" FOREIGN KEY ("evaluationCaseId") REFERENCES "EvaluationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationRun" ADD CONSTRAINT "EvaluationRun_agentRunId_fkey" FOREIGN KEY ("agentRunId") REFERENCES "AgentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemoOrder" ADD CONSTRAINT "DemoOrder_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Custom pgvector and active-memory indexes are intentionally maintained here
-- because Prisma cannot express vector operator classes or partial indexes.
CREATE INDEX memory_embedding_hnsw_idx
ON "Memory"
USING hnsw ("embedding" vector_cosine_ops);

CREATE INDEX memory_active_lookup_idx
ON "Memory" ("agentId", "agentUserId", "memoryType")
WHERE "status" = 'ACTIVE';

CREATE UNIQUE INDEX memory_active_canonical_key_idx
ON "Memory" ("agentId", "agentUserId", "canonicalKey")
WHERE "status" = 'ACTIVE'
  AND "canonicalKey" IS NOT NULL;

-- Inexpensive domain invariants are enforced in PostgreSQL as well as in
-- boundary validation and repository logic.
ALTER TABLE "Credential"
  ADD CONSTRAINT credential_encryption_key_version_positive
  CHECK ("encryptionKeyVersion" > 0);

ALTER TABLE "Message"
  ADD CONSTRAINT message_token_count_nonnegative
  CHECK ("tokenCount" IS NULL OR "tokenCount" >= 0);

ALTER TABLE "Memory"
  ADD CONSTRAINT memory_importance_score_range CHECK ("importanceScore" BETWEEN 0 AND 1),
  ADD CONSTRAINT memory_confidence_score_range CHECK ("confidenceScore" BETWEEN 0 AND 1),
  ADD CONSTRAINT memory_access_count_nonnegative CHECK ("accessCount" >= 0),
  ADD CONSTRAINT memory_version_positive CHECK ("version" > 0),
  ADD CONSTRAINT memory_validity_window CHECK ("validFrom" IS NULL OR "validTo" IS NULL OR "validFrom" <= "validTo");

ALTER TABLE "MemoryRevision"
  ADD CONSTRAINT memory_revision_version_positive CHECK ("version" > 0),
  ADD CONSTRAINT memory_revision_importance_score_range CHECK ("previousImportanceScore" BETWEEN 0 AND 1),
  ADD CONSTRAINT memory_revision_confidence_score_range CHECK ("previousConfidenceScore" BETWEEN 0 AND 1);

ALTER TABLE "Contradiction"
  ADD CONSTRAINT contradiction_distinct_memories CHECK ("leftMemoryId" <> "rightMemoryId"),
  ADD CONSTRAINT contradiction_confidence_range CHECK ("confidence" BETWEEN 0 AND 1);

ALTER TABLE "AgentRun"
  ADD CONSTRAINT agent_run_token_counts_nonnegative CHECK (
    ("contextTokenCount" IS NULL OR "contextTokenCount" >= 0) AND
    ("inputTokens" IS NULL OR "inputTokens" >= 0) AND
    ("outputTokens" IS NULL OR "outputTokens" >= 0) AND
    ("totalTokens" IS NULL OR "totalTokens" >= 0)
  ),
  ADD CONSTRAINT agent_run_latencies_nonnegative CHECK (
    ("retrievalLatencyMs" IS NULL OR "retrievalLatencyMs" >= 0) AND
    ("modelLatencyMs" IS NULL OR "modelLatencyMs" >= 0) AND
    ("toolLatencyMs" IS NULL OR "toolLatencyMs" >= 0) AND
    ("postProcessingLatencyMs" IS NULL OR "postProcessingLatencyMs" >= 0) AND
    ("totalLatencyMs" IS NULL OR "totalLatencyMs" >= 0)
  );

ALTER TABLE "RunMemory"
  ADD CONSTRAINT run_memory_rank_positive CHECK ("rank" > 0),
  ADD CONSTRAINT run_memory_scores_range CHECK (
    "semanticScore" BETWEEN 0 AND 1 AND "recencyScore" BETWEEN 0 AND 1 AND
    "importanceScore" BETWEEN 0 AND 1 AND "confidenceScore" BETWEEN 0 AND 1 AND
    "typeBoost" BETWEEN 0 AND 1 AND "finalScore" BETWEEN 0 AND 1
  ),
  ADD CONSTRAINT run_memory_token_count_nonnegative CHECK ("estimatedTokenCount" >= 0);

ALTER TABLE "RunEvent"
  ADD CONSTRAINT run_event_sequence_positive CHECK ("sequence" > 0),
  ADD CONSTRAINT run_event_duration_nonnegative CHECK ("durationMs" IS NULL OR "durationMs" >= 0);

ALTER TABLE "ToolDefinition"
  ADD CONSTRAINT tool_definition_timeout_range CHECK ("timeoutMs" > 0 AND "timeoutMs" <= 120000);

ALTER TABLE "ToolExecution"
  ADD CONSTRAINT tool_execution_time_nonnegative CHECK ("executionTimeMs" IS NULL OR "executionTimeMs" >= 0);

ALTER TABLE "EvaluationRun"
  ADD CONSTRAINT evaluation_run_usage_nonnegative CHECK (
    ("inputTokens" IS NULL OR "inputTokens" >= 0) AND
    ("outputTokens" IS NULL OR "outputTokens" >= 0) AND
    ("totalTokens" IS NULL OR "totalTokens" >= 0) AND
    ("latencyMs" IS NULL OR "latencyMs" >= 0)
  );
