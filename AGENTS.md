# AGENTS.md

## Product mission

Build a simple developer tool for testing and visualizing AI-agent memory orchestration.

The product must let a developer:

- Configure an agent that uses an OpenAI or OpenAI-compatible model API.
- Store and inspect conversation and long-term memories in PostgreSQL with pgvector.
- See exactly which memories were considered, selected, excluded, updated, contradicted, summarized, or expired for every run.
- Configure safe HTTP tools that an agent may call.
- Replay requests with different memory settings.
- Run deterministic evaluations of memory and tool behavior.
- Use the product through both a web dashboard and a TypeScript SDK.

The functional MVP and debuggability are more important than visual polish or generalized platform features.

---

## Read these files before changing code

For every task, read the smallest relevant set in this order:

1. `AGENTS.md`
2. `PLAN.md`
3. `docs/architecture.md`
4. The files named in the task
5. Existing tests for the affected behavior

Do not begin implementation until you understand the current milestone, package boundaries, and definition of done.

When a request conflicts with these files, follow the explicit user request and update the documentation so the repository remains internally consistent.

---

## Repository structure

```text
apps/
  web/                  Next.js dashboard and API route handlers
  worker/               BullMQ background workers

packages/
  contracts/            Shared Zod schemas and public TypeScript types
  core/                 Business logic and orchestration
  db/                   Prisma client, repositories, migrations, vector SQL
  sdk/                  Public TypeScript SDK
  ui/                   Shared UI components

docs/                   Architecture, API, security, and demo documentation
tests/                  Cross-package integration and end-to-end tests
```

### Package boundaries

#### `apps/web`

May contain:

- Next.js pages and layouts
- React components
- Route handlers
- Authentication and request-scoped wiring
- Server-Sent Events transport

Must not contain:

- Memory ranking algorithms
- Model-provider-specific business logic
- Direct pgvector SQL
- Secret-resolution logic
- Memory consolidation rules

Route handlers should only:

1. Authenticate.
2. Validate input.
3. Resolve dependencies.
4. Call a core service.
5. Serialize or stream the result.

#### `apps/worker`

May contain job registration and dependency wiring.

Job logic that is reusable or domain-specific belongs in `packages/core`.

#### `packages/core`

Owns:

- Agent run orchestration
- Retrieval and ranking
- Context construction
- Model-provider interfaces
- Tool-call loop
- Memory extraction and consolidation
- Contradiction handling
- Evaluation execution
- Cost and latency aggregation

It must depend on repository interfaces, not on HTTP, React, or Next.js objects.

#### `packages/db`

Owns:

- Prisma schema and migrations
- Prisma client creation
- Relational repositories
- Transactions
- All raw SQL and pgvector operations

No package outside `packages/db` may issue raw SQL.

#### `packages/contracts`

Owns public request, response, event, and configuration schemas.

Every external input must be validated with Zod at the boundary.

#### `packages/sdk`

Owns the public TypeScript client. It must depend only on public contracts and standard web APIs unless a dependency is clearly justified.

---

## Architectural rules

1. Build a modular monolith plus one background worker. Do not introduce microservices for the MVP.
2. Treat each agent request as an observable run with a durable trace.
3. Store both memory candidates and memories actually included in model context.
4. Never reconstruct run behavior later from unstructured logs when it can be stored as structured run data.
5. Use deterministic ranking, filtering, validation, and mutation application wherever possible.
6. The model may propose memory mutations, but application code must validate and apply them.
7. Immediate memory extraction and consolidation must complete before releasing the per-conversation lock.
8. Conversation summarization, expiration sweeps, cleanup, and re-embedding may run in background jobs.
9. Preserve memory history through revisions. Do not overwrite meaningful prior values without a revision.
10. Use canonical keys for updateable structured memories such as `preference.delivery_location`.
11. Do not expose private model reasoning. Selection explanations must be derived from observable score components and rules.
12. Keep provider-specific request and response formats behind provider adapters.
13. Keep embedding generation behind an embedding-provider interface.
14. The initial deployment must use one configured embedding model and one embedding dimension for the `Memory` table.
15. A replay creates a new run and never mutates the original run.

---

## Memory semantics

Supported MVP memory types:

- `CONVERSATION_SUMMARY`
- `USER_PREFERENCE`
- `ENTITY`
- `FACT`
- `TASK`
- `DECISION`
- `TOOL_RESULT`

Supported memory statuses:

- `ACTIVE`
- `SUPERSEDED`
- `CONTRADICTED`
- `EXPIRED`
- `DELETED`

### Required memory fields

Every memory must include:

- `id`
- `agentId`
- `agentUserId`
- `memoryType`
- `content`
- `importanceScore`
- `confidenceScore`
- `source`
- `status`
- `version`
- `createdAt`
- `updatedAt`

It may additionally include:

- `canonicalKey`
- `normalizedContent`
- `metadata`
- `embedding`
- `embeddingModel`
- `sourceMessageId`
- `validFrom`
- `validTo`
- `expiresAt`
- `lastAccessedAt`
- `accessCount`

### Creation and update rules

- Prefer updating an active memory with the same canonical key over creating a duplicate.
- Before updating content or metadata, create a `MemoryRevision` inside the same database transaction.
- Increment `version` on every update.
- Recompute the embedding whenever semantic content changes.
- Preserve `createdAt` during updates.
- Use optimistic concurrency when updating memories.
- An expired, deleted, superseded, or contradicted memory must not be returned by normal active retrieval.
- Small talk, greetings, acknowledgements, secrets, and transient wording should not become long-term memory.

### Contradictions

- A newer value for the same canonical key is normally an update, not an unresolved contradiction.
- Use validity dates when the information changed over time.
- Create a contradiction record only when incompatible claims both appear current or cannot be automatically resolved.
- Never silently delete contradictory evidence.

---

## Retrieval and ranking rules

Before every model response:

1. Load recent messages.
2. Generate an embedding for the incoming user message.
3. Retrieve semantically similar active memories.
4. Retrieve important active memories.
5. Retrieve active preferences, tasks, and decisions when relevant to the configured policy.
6. Exclude expired and inactive memories.
7. Deduplicate candidates.
8. Compute deterministic score components.
9. Select memories under the configured memory-count and token budgets.
10. Build a compact context block.
11. Persist candidate scores, selection reasons, rank, and context inclusion.

Default ranking weights:

```text
semantic similarity: 0.50
recency:            0.20
importance:         0.15
confidence:         0.10
type boost:         0.05
```

Do not change default weights without updating tests and `docs/architecture.md`.

Selection explanations must use facts such as:

- Semantic score
- Recency score or age
- Importance score
- Confidence score
- Type boost
- Final score
- Token-budget exclusion
- Duplicate suppression
- Inactive or expired status

Do not ask a model to invent an explanation of why a memory was selected.

---

## Run tracing rules

Every run must record, when applicable:

- Input and output
- Agent, user, conversation, provider, and model
- Effective memory configuration
- Recent messages loaded
- Memory candidates
- Score components
- Selected memories
- Memories included in context
- Context block and context token count
- Tool calls and sanitized results
- Memory mutations proposed
- Memory mutations applied
- Contradictions detected
- Input, output, and total token usage
- Estimated cost
- Retrieval, model, tool, post-processing, and total latency
- Structured errors
- Ordered run events

A run marked `COMPLETED` must have a final assistant output and completion timestamp.
A run marked `FAILED` must have a normalized error code and sanitized error message.

---

## Security rules

These rules are mandatory:

1. Never commit credentials or real API keys.
2. Never log plaintext model-provider or tool credentials.
3. Never return plaintext credentials to the browser or SDK.
4. Store application API keys as hashes, not reversible ciphertext.
5. Encrypt third-party credentials at rest through a dedicated credential service.
6. Store credential references in agents and tools, not secret values.
7. Redact authorization headers, cookies, API keys, tokens, passwords, and configured sensitive response fields before persistence.
8. Reject HTTP tool targets that resolve to loopback, link-local, private-network, multicast, or cloud-metadata addresses unless a development-only allowlist explicitly permits them.
9. Revalidate every redirect target.
10. Enforce tool timeouts, response-size limits, schema validation, and allowed HTTP methods.
11. Do not execute arbitrary user-supplied code, shell commands, or SQL.
12. Sanitize provider and tool errors before saving or returning them.
13. Tests must prove that secrets do not appear in API responses, run events, tool traces, or logs.

Development-only mock services may be allowlisted explicitly and must not weaken production defaults.

---

## TypeScript rules

- Enable TypeScript strict mode.
- Do not use `any`; use `unknown` and narrow it.
- Prefer discriminated unions for states and events.
- Export explicit return types for public functions.
- Use `readonly` where mutation is unnecessary.
- Validate environment variables once at process startup.
- Validate external payloads with Zod.
- Keep functions small enough to test directly.
- Use dependency injection for time, IDs, provider clients, repositories, queues, and locks when it improves deterministic testing.
- Do not swallow errors. Normalize, trace, and rethrow or return a typed result.
- Avoid adding dependencies when the standard library or an existing dependency is adequate.

---

## Database rules

- Use Prisma for ordinary relational access.
- Keep pgvector SQL in `packages/db` repositories.
- Parameterize all SQL values.
- Do not concatenate untrusted SQL fragments.
- Validate embeddings before converting them to vector literals.
- Use transactions for multi-row state changes such as memory update plus revision creation.
- Use indexes intentionally and document unusual index choices in migrations.
- Use UTC timestamps.
- Prefer soft deletion for user-facing memory deletion so run history remains explainable.
- Do not place large provider payloads in frequently queried columns. Store only sanitized, useful trace data.

---

## API rules

- Version public endpoints under `/api/v1`.
- Use consistent JSON error envelopes.
- Make idempotency behavior explicit for write endpoints where retries are likely.
- Do not expose internal database IDs unless they are part of the public API design.
- Paginate list endpoints.
- Use stable cursor pagination for runs and memories.
- Keep SDK types synchronized with API contracts.
- Streaming run endpoints must emit typed Server-Sent Events and a final terminal event.

Required MVP endpoints:

```text
POST   /api/v1/agents
POST   /api/v1/agents/:agentId/run
POST   /api/v1/agents/:agentId/memories/search
GET    /api/v1/agents/:agentId/memories
PATCH  /api/v1/memories/:memoryId
DELETE /api/v1/memories/:memoryId
POST   /api/v1/tools
POST   /api/v1/evaluations/run
GET    /api/v1/runs/:runId
POST   /api/v1/runs/:runId/replay
```

---

## Testing rules

Use:

- Vitest for unit tests
- Testcontainers or the repository's test Docker services for PostgreSQL, pgvector, and Redis integration tests
- Playwright for critical dashboard flows
- Mock model and embedding providers for deterministic tests
- A mock order-management API for tool tests

Every behavior change needs tests at the lowest useful level.

Required critical tests:

- Agent and user memory isolation
- Expired and inactive memory exclusion
- Semantic result ordering
- Ranking-weight calculation
- Token-budget selection
- Canonical-key update instead of duplicate creation
- Revision creation and optimistic concurrency
- Contradiction handling
- Per-conversation serialization
- Tool argument schema validation
- SSRF and redirect blocking
- Secret redaction
- Tool timeout and response-size enforcement
- Run failure normalization
- Replay immutability
- Preference-recall evaluation
- Outdated-information update evaluation
- Irrelevant-detail non-storage evaluation
- Long-range retrieval evaluation
- Tool-call evaluation

Do not use live paid model calls in the default test suite.

---

## Commands

Use the commands defined by the repository. The intended commands are:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Before declaring a task complete, run the smallest relevant checks plus:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

For database changes, also run migrations and relevant integration tests.
For user-interface changes, also run the relevant Playwright test or document why it cannot run.

Never claim a command passed unless it was actually run and its result was observed.

---

## Codex task workflow

For each implementation task:

1. Restate the goal in one sentence internally.
2. Inspect the relevant plan milestone and existing code.
3. Identify the smallest coherent change.
4. List files that must change before editing.
5. Implement the behavior without unrelated refactors.
6. Add or update tests.
7. Run validation commands.
8. Review the diff for boundary, security, and traceability violations.
9. Update `PLAN.md` checkboxes only when their acceptance criteria are met.
10. Summarize changed behavior, tests run, and any remaining risks.

If a task is underspecified, choose the simplest implementation consistent with the architecture and document the assumption. Do not block on cosmetic ambiguity.

Do not mark future work as complete, create placeholder success responses, or silently skip tests.

---

## Definition of done

A task is done only when all applicable conditions are true:

- Requested behavior works end to end at the relevant layer.
- Public input is validated.
- Errors are normalized and sanitized.
- Run behavior is observable where applicable.
- Secrets cannot leak through the new path.
- Tests cover success and meaningful failure cases.
- Linting, type checking, and relevant tests pass.
- Database migrations are reversible or have a documented forward-only reason.
- Documentation and contracts match the implementation.
- No unrelated changes are included.

The MVP is done only when the complete demo scenario in `docs/architecture.md` passes through both the dashboard and SDK.
