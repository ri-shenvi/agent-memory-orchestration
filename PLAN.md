# PLAN.md

## Purpose

This file is the implementation plan and progress ledger for the memory orchestration debugger MVP.

Codex should execute one small, reviewable task at a time. A checkbox may be marked complete only when its acceptance criteria and required validation have passed. Do not mark an entire milestone complete because scaffolding exists.

Status conventions:

- `[ ]` not started or incomplete
- `[x]` complete and validated
- `BLOCKED:` blocked by a concrete external dependency
- `DECISION:` a resolved architectural choice that future work must follow

---

## MVP outcome

A developer can create an agent, chat with it, inspect its complete memory and tool trace, edit memory, replay a run with different settings, execute deterministic evaluations, and call the same agent through a TypeScript SDK.

The MVP demo must prove this sequence:

1. A user states a preferred delivery location.
2. The system stores one active `USER_PREFERENCE` memory with canonical key `preference.delivery_location`.
3. The user later asks for an order update.
4. The agent retrieves the delivery preference.
5. The agent calls a mock order-management API.
6. The run view displays memory candidates, selected memory, context, tool request, sanitized tool response, latency, tokens, and estimated cost.
7. The user changes the preferred location.
8. The existing active memory is updated instead of duplicated.
9. The prior value appears in memory revision history.
10. The same flow works from the TypeScript SDK.

---

## MVP non-goals

Do not add these before the MVP acceptance suite passes:

- Multi-agent collaboration
- Workflow or graph builder
- Arbitrary user-authored code tools
- Fine-tuned rerankers
- Automatic prompt optimization
- Enterprise RBAC
- Billing
- Cross-region deployment
- Multiple vector dimensions in one memory table
- Distributed microservices
- Visual design system beyond a clean functional interface

---

## Global acceptance criteria

Every milestone must preserve these conditions:

- TypeScript strict mode passes.
- No plaintext secret appears in client responses, persisted traces, or logs.
- External inputs are validated.
- Database changes use migrations.
- New business behavior has deterministic tests.
- Agent and user data are isolated.
- Runs remain observable and replayable.
- Documentation reflects implemented behavior.

---

# Milestone 0 — Repository foundation

## Goal

Create a reproducible monorepo that starts locally with PostgreSQL/pgvector and Redis.

### Tasks

- [x] Create a pnpm workspace with `apps/web`, `apps/worker`, and packages `contracts`, `core`, `db`, `sdk`, and `ui`.
- [x] Configure shared TypeScript strict settings and package path aliases.
- [x] Create the Next.js App Router application.
- [x] Configure Tailwind and the minimal component library used by the dashboard.
- [x] Add Docker Compose services for PostgreSQL with pgvector and Redis.
- [x] Add environment validation using Zod.
- [x] Add Prisma and a shared Prisma client singleton.
- [x] Add Vitest configuration for unit tests.
- [x] Add integration-test configuration with isolated PostgreSQL and Redis services.
- [x] Add Playwright configuration.
- [x] Add ESLint and formatting.
- [x] Add root scripts for build, lint, typecheck, tests, migrations, seeding, and development.
- [x] Add `/api/health` that checks application, database, and Redis connectivity without exposing secrets.
- [x] Add CI that runs install, lint, typecheck, unit tests, and build.

### Acceptance criteria

- [x] `pnpm install` succeeds from a clean checkout.
- [x] `docker compose up -d` starts PostgreSQL/pgvector and Redis.
- [x] `pnpm db:generate` succeeds.
- [x] `pnpm dev` starts the web app and worker.
- [x] The health endpoint reports healthy dependencies.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.

---

# Milestone 1 — Persistence and database model

## Goal

Implement the relational schema, vector storage, repositories, and seed data.

### Tasks

- [ ] Add Prisma enums for memory, run, message, tool execution, and evaluation states.
- [ ] Add `Workspace`.
- [ ] Add hashed `AppApiKey` records.
- [ ] Add encrypted credential metadata and credential references.
- [ ] Add `Agent` and `AgentUser`.
- [ ] Add `Conversation` and `Message`.
- [ ] Add `Memory`, `MemoryRevision`, and `Contradiction`.
- [ ] Add `AgentRun`, `RunMemory`, and `RunEvent`.
- [ ] Add `ToolDefinition` and `ToolExecution`.
- [ ] Add `EvaluationCase` and `EvaluationRun`.
- [ ] Add a custom migration that enables pgvector and converts the memory embedding column to the configured vector dimension.
- [ ] Add HNSW and relational indexes described in `docs/architecture.md`.
- [ ] Implement `packages/db/src/memory-repository.ts`.
- [ ] Implement repositories for agents, users, conversations, messages, runs, tools, credentials, and evaluations.
- [ ] Add a transaction helper and typed database error normalization.
- [ ] Add seed data for a demo workspace, demo agent, demo user, and mock order records.

### Required tests

- [ ] Create and read each core entity.
- [ ] Create a memory with an embedding.
- [ ] Semantic search returns nearest memories first.
- [ ] Agent and user isolation is enforced in every memory query.
- [ ] Expired and inactive memories are excluded from active retrieval.
- [ ] Updating a memory creates a revision in the same transaction.
- [ ] Optimistic concurrency rejects stale memory updates.
- [ ] Soft deletion preserves historical run references.
- [ ] Active canonical-key uniqueness is enforced.

### Acceptance criteria

- [ ] A clean database can migrate and seed.
- [ ] All repository integration tests pass against PostgreSQL with pgvector.
- [ ] No raw SQL exists outside `packages/db`.

---

# Milestone 2 — Public contracts and provider adapters

## Goal

Define stable typed contracts and isolate model-provider behavior.

### Tasks

- [ ] Define Zod schemas for agent creation and agent configuration.
- [ ] Define schemas for run requests, run responses, and streaming events.
- [ ] Define schemas for memory search, list, edit, delete, merge, and contradiction resolution.
- [ ] Define schemas for tool creation, update, test, and execution traces.
- [ ] Define schemas for evaluations and assertions.
- [ ] Define `ModelProvider` and `EmbeddingProvider` interfaces.
- [ ] Implement an OpenAI Responses provider adapter.
- [ ] Implement an OpenAI-compatible Chat Completions provider adapter.
- [ ] Implement an embedding provider adapter.
- [ ] Implement deterministic mock model and embedding providers.
- [ ] Normalize provider tool calls, token usage, finish reasons, and errors into internal contracts.
- [ ] Add configurable model pricing records or configuration for cost estimates.

### Required tests

- [ ] Provider payload construction.
- [ ] Normalized text and tool-call output.
- [ ] Provider error sanitization.
- [ ] Mock provider deterministic behavior.
- [ ] Cost calculation for configured model prices.

### Acceptance criteria

- [ ] Core orchestration imports only provider interfaces and normalized results.
- [ ] No provider-specific payload type leaks into public API contracts.

---

# Milestone 3 — Basic agent runs without long-term memory

## Goal

Create an observable chat run before adding memory retrieval.

### Tasks

- [ ] Implement app API-key authentication.
- [ ] Implement `POST /api/v1/agents`.
- [ ] Implement `GET /api/v1/agents` and `GET /api/v1/agents/:agentId` for the dashboard.
- [ ] Implement conversation get-or-create behavior.
- [ ] Implement a per-agent-user conversation lock backed by Redis.
- [ ] Implement `packages/core/src/orchestration/run-agent.ts` with memory disabled initially.
- [ ] Persist the user message before generation.
- [ ] Persist the assistant message after generation.
- [ ] Persist run status transitions and ordered run events.
- [ ] Persist provider/model, latency, token usage, estimated cost, and sanitized errors.
- [ ] Implement `POST /api/v1/agents/:agentId/run` as JSON.
- [ ] Implement typed Server-Sent Events for streaming.
- [ ] Implement `GET /api/v1/runs/:runId`.
- [ ] Build a minimal playground chat interface.
- [ ] Build the first run-inspection view.

### Required tests

- [ ] Successful non-streaming run.
- [ ] Successful streaming run with one terminal event.
- [ ] Provider failure creates a failed run with sanitized error data.
- [ ] Concurrent messages for one conversation execute serially.
- [ ] Different users may run concurrently.
- [ ] API-key workspace isolation.

### Acceptance criteria

- [ ] A developer can create an agent and complete a normal conversation.
- [ ] Every run can be inspected after completion or failure.

---

# Milestone 4 — Memory retrieval, ranking, and context

## Goal

Retrieve relevant long-term memories and make every selection decision inspectable.

### Tasks

- [ ] Implement recent-message loading with configurable count and token cap.
- [ ] Generate a query embedding for the incoming user message.
- [ ] Retrieve top semantic candidates.
- [ ] Retrieve high-importance candidates.
- [ ] Retrieve current preferences, open tasks, and decisions according to policy.
- [ ] Exclude inactive and expired memories.
- [ ] Deduplicate candidates by ID, canonical key, and normalized-content similarity.
- [ ] Implement recency decay.
- [ ] Implement configurable ranking weights with architecture defaults.
- [ ] Implement memory-type boosts.
- [ ] Persist every candidate and score component in `RunMemory`.
- [ ] Generate deterministic selection and exclusion reasons.
- [ ] Select memories under count and token budgets.
- [ ] Build the compact memory context block.
- [ ] Persist the exact context block and included memory IDs.
- [ ] Update access count and last-accessed timestamps only for memories included in context.
- [ ] Implement memory search and list endpoints.
- [ ] Show candidates, selected memories, reasons, context, and retrieval latency in the playground.

### Required tests

- [ ] Semantic ordering.
- [ ] Recency half-life calculation.
- [ ] Default weighted score calculation.
- [ ] Custom weight override calculation.
- [ ] Duplicate suppression.
- [ ] Canonical-key preference inclusion.
- [ ] Count-budget enforcement.
- [ ] Token-budget enforcement.
- [ ] Exclusion reasons.
- [ ] Access tracking only for included memories.

### Acceptance criteria

- [ ] A run can explain which memories were considered and why each was included or excluded.
- [ ] Disabling memory produces a valid run with no memory context.

---

# Milestone 5 — Memory extraction and consolidation

## Goal

Detect useful information after a response and apply safe, traceable memory mutations.

### Tasks

- [ ] Define the structured memory-mutation proposal schema.
- [ ] Create an extraction prompt that stores useful durable information and rejects irrelevant details and secrets.
- [ ] Validate all model-proposed mutations.
- [ ] Normalize canonical keys.
- [ ] Implement deterministic policies for create, update, ignore, expire, and delete.
- [ ] Update existing active canonical-key memories instead of duplicating them.
- [ ] Add a memory revision before content or metadata updates.
- [ ] Re-embed changed semantic content.
- [ ] Detect exact and near duplicates.
- [ ] Implement temporal update handling with validity dates.
- [ ] Implement unresolved contradiction creation.
- [ ] Persist proposed and applied mutation events to the run trace.
- [ ] Run extraction and consolidation synchronously before releasing the conversation lock.
- [ ] Implement memory edit, soft delete, and merge endpoints.
- [ ] Implement contradiction list and resolution endpoints.
- [ ] Build memory detail, revision history, merge, and contradiction UI.

### Required tests

- [ ] Explicit preference creates one memory.
- [ ] Changed preference updates the same active memory.
- [ ] Revision preserves the prior value.
- [ ] Repeated equivalent statement does not create a duplicate.
- [ ] Greeting and acknowledgement do not create memory.
- [ ] Secret-like content is rejected or redacted according to policy.
- [ ] Temporal change is represented as an update when appropriate.
- [ ] Unresolved incompatible claims create a contradiction.
- [ ] A subsequent message immediately sees the newly consolidated memory.

### Acceptance criteria

- [ ] The delivery-location create and update sequence passes end to end.
- [ ] The dashboard shows the applied mutation and revision history.

---

# Milestone 6 — Safe HTTP tools and mock order API

## Goal

Let developers configure agent-callable HTTP tools without exposing secrets or permitting unsafe network access.

### Tasks

- [ ] Implement credential encryption and server-side credential resolution.
- [ ] Implement tool create, list, update, delete, and test endpoints.
- [ ] Convert tool request schemas into provider tool definitions.
- [ ] Implement a bounded model/tool execution loop with a configurable maximum number of tool rounds.
- [ ] Validate model tool arguments before execution.
- [ ] Implement endpoint template resolution.
- [ ] Implement DNS and IP validation that blocks unsafe destinations by default.
- [ ] Revalidate redirect destinations.
- [ ] Implement method allowlisting, timeout, response-size, and redirect limits.
- [ ] Implement request and response schema validation.
- [ ] Implement credential injection after validation.
- [ ] Implement configurable request and response redaction.
- [ ] Persist sanitized tool requests, responses, status, timing, and errors.
- [ ] Implement the mock order-management API.
- [ ] Seed `get_latest_order` and any other required demo tools.
- [ ] Display tool calls in the playground and run view.

### Required tests

- [ ] Valid tool call succeeds.
- [ ] Invalid arguments never reach the network.
- [ ] Disallowed HTTP method is rejected.
- [ ] Loopback, private, link-local, and metadata addresses are blocked in production mode.
- [ ] Redirect to a blocked address is rejected.
- [ ] Timeout and response-size limits work.
- [ ] Authorization and configured secret fields are redacted.
- [ ] Plaintext credentials do not appear in traces, logs, or API responses.
- [ ] Tool error is sanitized and visible in the run trace.

### Acceptance criteria

- [ ] The demo agent calls the mock order API and returns an order update.
- [ ] The dashboard displays the selected memory and sanitized API call.

---

# Milestone 7 — Dashboard debugger

## Goal

Provide the simplest useful interface for configuring and debugging memory behavior.

### Tasks

- [ ] Add main navigation: Playground, Memories, Runs, Tools, Evaluations, Settings.
- [ ] Add agent selector and basic agent setup.
- [ ] Add provider credential setup with masked values.
- [ ] Complete the playground chat interface.
- [ ] Add Memories Used panel.
- [ ] Add Tool Calls panel.
- [ ] Add Agent Context panel.
- [ ] Add Trace panel.
- [ ] Add latency, token, and estimated-cost summary.
- [ ] Add memory table with search and filters for type, agent, user, importance, date, and status.
- [ ] Add memory detail drawer.
- [ ] Add run list with cursor pagination.
- [ ] Add complete run detail page.
- [ ] Add tool-definition form and test interface.
- [ ] Add useful loading, empty, and error states.

### Required end-to-end tests

- [ ] Create an agent.
- [ ] Store and view a preference.
- [ ] Retrieve a preference in a later run.
- [ ] Inspect a tool call.
- [ ] Edit and delete a memory.
- [ ] View revision history.
- [ ] Filter memories.
- [ ] Inspect a failed run.

### Acceptance criteria

- [ ] A new developer can complete the demo without reading internal database records.
- [ ] The interface prioritizes the debugger data and remains usable without advanced styling.

---

# Milestone 8 — Replay

## Goal

Re-execute a historical request with modified settings while preserving the original run.

### Tasks

- [ ] Add `replayedFromRunId` or an equivalent immutable relationship.
- [ ] Implement `POST /api/v1/runs/:runId/replay`.
- [ ] Allow overrides for memory enabled, max memories, weights, types, token budget, model, and tool availability.
- [ ] Copy the original user input and necessary conversation snapshot references.
- [ ] Create a new run and new trace.
- [ ] Build side-by-side run comparison.

### Required tests

- [ ] Original run remains unchanged.
- [ ] Replay uses requested overrides.
- [ ] Memory-disabled replay includes no memory context.
- [ ] Comparison displays score, token, cost, latency, output, and tool differences.

### Acceptance criteria

- [ ] A developer can compare the same request with and without memory.

---

# Milestone 9 — Evaluations

## Goal

Run deterministic scenarios that verify memory and tool behavior.

### Tasks

- [ ] Implement evaluation-case CRUD.
- [ ] Implement isolated evaluation users and conversations.
- [ ] Implement setup messages and a trigger message.
- [ ] Implement deterministic assertions:
  - [ ] memory exists
  - [ ] memory count
  - [ ] memory retrieved
  - [ ] memory not stored
  - [ ] tool called
  - [ ] tool not called
  - [ ] response contains
  - [ ] maximum latency
  - [ ] maximum token usage
- [ ] Implement `POST /api/v1/evaluations/run`.
- [ ] Persist expected behavior, actual behavior, assertion results, memories, tools, latency, tokens, cost, and pass/fail.
- [ ] Build evaluation list, run, and result pages.
- [ ] Seed the six required MVP scenarios.

### Required seeded scenarios

- [ ] Remembers a user preference.
- [ ] Updates outdated information.
- [ ] Avoids storing irrelevant details.
- [ ] Retrieves correct memory after many conversations.
- [ ] Correctly calls a third-party API.
- [ ] Memory reduces repeated questions.

### Acceptance criteria

- [ ] The seeded evaluation suite runs without live paid model calls by using deterministic providers.
- [ ] Each result clearly shows expected versus actual behavior and pass/fail reasons.

---

# Milestone 10 — TypeScript SDK

## Goal

Expose the MVP through a small typed SDK.

### Tasks

- [ ] Implement `MemoryAgent` constructor with `agentId`, `userId`, `apiKey`, optional `baseUrl`, and optional `conversationId`.
- [ ] Implement `run`.
- [ ] Implement streaming run support.
- [ ] Implement `searchMemories`.
- [ ] Implement `listMemories`.
- [ ] Implement `getRun`.
- [ ] Implement typed API errors.
- [ ] Export public contracts.
- [ ] Add Node and browser compatibility tests where applicable.
- [ ] Add a runnable demo example.
- [ ] Add package build and publishing configuration.

### Acceptance criteria

The following works against the local application:

```ts
import { MemoryAgent } from "@app/sdk";

const agent = new MemoryAgent({
  agentId: "sales-agent",
  userId: "user-123",
  apiKey: process.env.APP_API_KEY!,
});

const response = await agent.run({
  message: "Find my latest order and tell me when it arrives.",
});

console.log(response.text);
console.log(response.memoriesUsed);
console.log(response.toolCalls);
```

---

# Milestone 11 — Background maintenance and hardening

## Goal

Add asynchronous maintenance without weakening immediate consistency.

### Tasks

- [ ] Configure BullMQ queues and worker health checks.
- [ ] Add conversation-summary threshold detection.
- [ ] Add summary generation and summary-memory updates.
- [ ] Add memory expiration sweep.
- [ ] Add cleanup for soft-deleted data according to retention policy.
- [ ] Add re-embedding job with model/version tracking.
- [ ] Add evaluation-batch jobs.
- [ ] Add retry and dead-letter behavior.
- [ ] Add queue observability without secret-bearing payloads.
- [ ] Add rate limiting and request-size limits.
- [ ] Add database backup and restore documentation.
- [ ] Add production deployment documentation.
- [ ] Run security review against every secret and HTTP-tool path.
- [ ] Run query-plan checks for memory search and run-list endpoints.

### Required tests

- [ ] Summary job is idempotent.
- [ ] Expiration sweep changes status correctly.
- [ ] Re-embedding job is resumable.
- [ ] Failed jobs retry and eventually reach dead-letter state.
- [ ] Immediate preference consistency does not depend on the queue.

### Acceptance criteria

- [ ] Background worker failure does not prevent ordinary agent runs, except for explicitly asynchronous features.
- [ ] The complete MVP demo and evaluation suite pass.

---

# Final MVP release checklist

- [ ] All milestone acceptance criteria are complete.
- [ ] The complete demo passes in the dashboard.
- [ ] The complete demo passes through the SDK.
- [ ] The seeded deterministic evaluation suite passes.
- [ ] No default test uses a live paid model.
- [ ] Secret-leak tests pass.
- [ ] SSRF tests pass.
- [ ] Database migrations work from a clean database.
- [ ] `pnpm lint` passes.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm test` passes.
- [ ] `pnpm test:integration` passes.
- [ ] `pnpm test:e2e` passes.
- [ ] `pnpm build` passes.
- [ ] README contains a clean-start quickstart.
- [ ] Architecture and API documentation match the implementation.
