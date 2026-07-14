# Architecture

## 1. System purpose

This product is a developer tool for testing and visualizing how an AI agent stores, retrieves, updates, summarizes, and uses memory across conversations.

Its primary value is not simply that the agent has memory. Its value is that a developer can inspect and reproduce the memory behavior of every response.

The system therefore treats each agent request as a durable, observable run with structured evidence for:

- Which recent messages were loaded
- Which long-term memories were considered
- How every candidate was scored
- Which memories were selected
- Which memories were excluded and why
- What context was sent to the model
- Which tools were offered and called
- What sanitized tool data was returned
- Which new memories were proposed
- Which memory mutations were actually applied
- What contradictions were detected
- How long each stage took
- How many tokens were used
- What the estimated model cost was

---

## 2. Goals

The MVP must:

1. Support agents configured with a name, system prompt, provider protocol, model, and server-side credential reference.
2. Support OpenAI and OpenAI-compatible APIs through provider adapters.
3. Persist conversations and long-term memories in PostgreSQL with pgvector.
4. Retrieve memory using semantic relevance, recency, importance, confidence, and type-aware rules.
5. Update existing structured memory instead of creating avoidable duplicates.
6. Preserve memory revision history.
7. Detect unresolved contradictions.
8. Allow safe, schema-validated HTTP tool calls.
9. Never expose plaintext secrets in the browser, SDK, traces, or logs.
10. Provide a clean dashboard for playground, memories, runs, tools, evaluations, and settings.
11. Provide replay with memory-setting overrides.
12. Provide deterministic evaluation scenarios.
13. Provide a small TypeScript SDK.
14. Demonstrate the complete product through a mock order-management API.

---

## 3. Non-goals for the MVP

The MVP is not:

- A multi-agent orchestration framework
- A general workflow builder
- A hosted arbitrary-code execution platform
- A vector-database abstraction layer
- An enterprise identity and authorization product
- An automatic prompt-optimization platform
- A replacement for provider observability products
- A distributed microservice architecture

These may be considered only after the MVP acceptance suite passes.

---

## 4. Architectural style

Use a modular monolith with a separate background worker.

```text
┌────────────────────────────────────────────────────────────┐
│ Browser dashboard / TypeScript SDK                         │
└───────────────────────────────┬────────────────────────────┘
                                │ HTTPS / SSE
                                ▼
┌────────────────────────────────────────────────────────────┐
│ Next.js web application                                    │
│                                                            │
│ - Pages and React components                               │
│ - Authentication                                            │
│ - Route handlers                                            │
│ - Request validation                                        │
│ - Dependency wiring                                         │
│ - SSE transport                                             │
└───────────────────────────────┬────────────────────────────┘
                                │ calls typed core services
                                ▼
┌────────────────────────────────────────────────────────────┐
│ Core domain packages                                       │
│                                                            │
│ - Agent-run orchestration                                   │
│ - Memory retrieval and ranking                              │
│ - Context construction                                      │
│ - Model-provider adapters                                   │
│ - Tool execution loop                                       │
│ - Memory extraction and consolidation                       │
│ - Contradiction handling                                    │
│ - Evaluation engine                                         │
└───────────────┬─────────────────────────────┬──────────────┘
                │ repository interfaces       │ provider APIs
                ▼                             ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│ PostgreSQL + pgvector        │   │ OpenAI-compatible APIs   │
│                              │   │ and third-party tools    │
│ - Relational state           │   └──────────────────────────┘
│ - Memories and embeddings    │
│ - Run traces                 │
│ - Evaluation results         │
└──────────────────────────────┘
                ▲
                │
┌───────────────┴────────────────────────────────────────────┐
│ Redis + BullMQ                                             │
│                                                            │
│ - Per-conversation locks                                   │
│ - Short-lived run/stream coordination                       │
│ - Summarization jobs                                        │
│ - Expiration and cleanup jobs                               │
│ - Re-embedding jobs                                         │
│ - Evaluation batches                                        │
└────────────────────────────────────────────────────────────┘
```

### Why not microservices

The initial system has one cohesive domain, one primary database, and a strong need for transactional consistency between messages, run traces, revisions, and memory mutations. Microservices would add deployment, networking, versioning, and consistency costs without improving the MVP.

### Why a separate worker

Immediate response generation and immediate memory consolidation belong in the request path. Maintenance work such as conversation summarization, expiration sweeps, cleanup, and re-embedding does not. A separate worker isolates those jobs while preserving one codebase and one database.

---

## 5. Recommended stack

| Layer | Technology |
|---|---|
| Web application | Next.js App Router and TypeScript |
| UI | Tailwind and a minimal component library |
| API | Next.js Route Handlers under `/api/v1` |
| Streaming | Server-Sent Events |
| Validation | Zod |
| Database | PostgreSQL |
| Vector search | pgvector |
| ORM | Prisma for relational access |
| Vector SQL | Parameterized raw SQL inside `packages/db` |
| Ephemeral state | Redis |
| Background jobs | BullMQ |
| Unit tests | Vitest |
| Integration tests | PostgreSQL/pgvector and Redis test services or Testcontainers |
| Browser tests | Playwright |
| Monorepo | pnpm workspaces |

---

## 6. Repository and package boundaries

```text
apps/
  web/
    app/
      api/v1/
      playground/
      memories/
      runs/
      tools/
      evaluations/
      settings/
    components/
    lib/

  worker/
    src/
      jobs/
      index.ts

packages/
  contracts/
    src/
      agents.ts
      runs.ts
      memories.ts
      tools.ts
      evaluations.ts
      events.ts
      errors.ts

  core/
    src/
      orchestration/
      memory/
      providers/
      tools/
      evaluations/
      security/

  db/
    prisma/
      schema.prisma
      migrations/
      seed.ts
    src/
      client.ts
      memory-repository.ts
      run-repository.ts
      agent-repository.ts
      conversation-repository.ts
      message-repository.ts
      tool-repository.ts
      evaluation-repository.ts

  sdk/
    src/
      memory-agent.ts
      errors.ts
      index.ts

  ui/
    src/

docs/
  architecture.md
  api.md
  security.md
  demo.md
```

The web application may wire dependencies but may not own domain logic. Raw SQL is restricted to the database package. Provider-specific formats are restricted to provider adapters.

---

## 7. Core domain model

### Workspace

Tenant boundary for agents, credentials, application API keys, tools, runs, and users.

### Agent

Configuration for one logical agent:

- Name and slug
- System prompt
- Provider
- Protocol, such as Responses or Chat Completions
- Model
- Optional provider base URL
- Server-side credential reference
- Memory enabled flag
- Effective memory configuration

An agent never stores a plaintext API key.

### AgentUser

A workspace-scoped mapping from an external user ID to an internal user record. All conversations and memories are isolated by both agent and agent user.

### Conversation and Message

A conversation contains ordered user, assistant, system, and tool messages. Messages are durable and may point to the run that created them.

### Memory

A durable item that may be retrieved in future conversations.

Supported types:

- `CONVERSATION_SUMMARY`
- `USER_PREFERENCE`
- `ENTITY`
- `FACT`
- `TASK`
- `DECISION`
- `TOOL_RESULT`

Supported statuses:

- `ACTIVE`
- `SUPERSEDED`
- `CONTRADICTED`
- `EXPIRED`
- `DELETED`

Important fields:

- Agent and user ownership
- Type
- Canonical key
- Content and normalized content
- Metadata
- Embedding and embedding model
- Importance and confidence
- Status and source
- Validity and expiration timestamps
- Access timestamp and count
- Version and timestamps

### MemoryRevision

An immutable snapshot of the previous memory content and metadata created before a meaningful update. It provides auditability without keeping multiple active duplicates.

### Contradiction

A relationship between two incompatible memories that cannot be resolved automatically. A normal change to the same canonical key is usually a revision, not a contradiction.

### AgentRun

A durable execution record for one user request. It stores status, input, output, effective configuration, context block, model, provider, latency, usage, cost, and normalized failure data.

### RunMemory

A join record between a run and a candidate memory. It stores:

- Candidate rank
- Semantic score
- Recency score
- Importance score
- Confidence score
- Type boost
- Final score
- Deterministic selection or exclusion reason
- Whether it was included in context
- Estimated token count

This table is essential to the debugger.

### RunEvent

An ordered structured trace event. Events should capture stage transitions and useful domain actions without storing secrets or hidden model reasoning.

### ToolDefinition and ToolExecution

A tool definition describes a safe HTTP operation. A tool execution stores a sanitized request, sanitized response, timing, status, and normalized errors.

### EvaluationCase and EvaluationRun

An evaluation case defines setup messages, a trigger message, and deterministic assertions. An evaluation run records expected and actual behavior plus pass/fail results.

---

## 8. Agent-run state machine

Recommended run statuses:

```text
QUEUED
  ↓
RETRIEVING_MEMORY
  ↓
GENERATING
  ↓
EXECUTING_TOOLS   ──┐
  ↑                  │ zero or more bounded rounds
  └──────────────────┘
  ↓
POST_PROCESSING
  ↓
COMPLETED
```

Any nonterminal state may transition to `FAILED`.

A completed run must have:

- Final assistant text
- Completion timestamp
- Token usage when the provider supplies it
- Total latency
- Effective configuration

A failed run must have:

- Failure timestamp
- Stable normalized error code
- Sanitized message
- The latest completed trace stage

---

## 9. End-to-end run flow

### 9.1 Request boundary

1. Authenticate the application API key.
2. Resolve the workspace.
3. Validate the run request.
4. Resolve the agent within the workspace.
5. Acquire a lock keyed by `agentId + externalUserId` or by conversation ID once known.
6. Get or create the `AgentUser`.
7. Get or create the conversation.
8. Create the run and save the effective configuration.
9. Save the user message.

The lock prevents two simultaneous turns for the same logical conversation from extracting or updating memory out of order.

### 9.2 Retrieval

1. Load recent messages using both count and token limits.
2. If memory is enabled, create an embedding for the incoming message.
3. Retrieve semantic candidates.
4. Retrieve high-importance candidates.
5. Retrieve active preferences, tasks, and decisions according to policy.
6. Exclude inactive and expired records.
7. Deduplicate candidates.
8. Compute score components.
9. Persist all candidate records in `RunMemory`.
10. Select memories under count and token budgets.
11. Build and persist the context block.

### 9.3 Model and tool loop

1. Create the normalized provider request using:
   - Agent system prompt
   - Compact memory context
   - Recent messages
   - Current user message
   - Enabled tool definitions
2. Call the model provider.
3. If the model returns tool calls:
   - Validate tool count and tool-round limits.
   - Validate each argument object against the tool request schema.
   - Validate the target endpoint.
   - Resolve credentials server-side.
   - Execute the HTTP request with limits.
   - Redact and persist the result.
   - Send the sanitized tool result back to the model.
4. Continue until the model returns final text or a bounded limit is reached.
5. Save the assistant message.

### 9.4 Memory extraction and consolidation

1. Ask the configured extraction mechanism for structured mutation proposals based on:
   - Current user message
   - Final assistant response
   - Relevant sanitized tool results
2. Validate proposals.
3. Reject irrelevant, duplicate, unsafe, or secret-bearing proposals.
4. Resolve canonical keys.
5. Apply creates, updates, expiration, or deletion deterministically.
6. Create revisions before updates.
7. Recompute embeddings for changed semantic content.
8. Detect unresolved contradictions.
9. Persist proposed and applied mutation events.
10. Update included memories' access timestamps and counts.

This phase must complete before releasing the conversation lock so the next user turn sees the newest memory state.

### 9.5 Completion and maintenance

1. Aggregate latency, usage, and cost.
2. Mark the run complete.
3. Release the lock.
4. Enqueue noncritical maintenance:
   - Conversation summary check
   - Expiration check
   - Cleanup check

Queue failure after run completion should be logged and traced but should not retroactively fail the agent response.

---

## 10. Memory retrieval

### 10.1 Candidate sources

Default MVP candidate sources:

- Last 12 recent messages, separately from long-term memory
- Top 30 semantic memory matches
- Top 10 high-importance memories
- Active user preferences
- Active tasks
- Relevant decisions

All values are configurable in the agent memory configuration.

### 10.2 Active-memory filter

Normal retrieval requires:

```text
status = ACTIVE
AND (expiresAt IS NULL OR expiresAt > now)
AND agentId = current agent
AND agentUserId = current user
```

### 10.3 Semantic similarity

Use cosine distance through pgvector. Convert distance to similarity:

```text
semanticScore = 1 - cosineDistance
```

The database package owns the raw query and returns a normalized numeric score.

### 10.4 Recency score

Use exponential decay with a configurable half-life:

```text
ageDays = (now - relevantTimestamp) / oneDay
recencyScore = exp(-ln(2) * ageDays / halfLifeDays)
```

Use `updatedAt` for mutable facts and preferences. Use the newest meaningful timestamp among `updatedAt`, `lastAccessedAt`, and `createdAt` only if the configured policy explicitly gives retrieval access additional recency value. The initial implementation should use `updatedAt` for predictable behavior.

Default half-life: 30 days.

### 10.5 Type boost

Default normalized boosts:

| Memory type | Boost |
|---|---:|
| USER_PREFERENCE | 1.00 |
| TASK | 0.90 |
| DECISION | 0.90 |
| FACT | 0.70 |
| ENTITY | 0.60 |
| CONVERSATION_SUMMARY | 0.50 |
| TOOL_RESULT | 0.40 |

### 10.6 Final score

Default formula:

```text
finalScore =
  semanticScore   * 0.50 +
  recencyScore    * 0.20 +
  importanceScore * 0.15 +
  confidenceScore * 0.10 +
  typeBoost        * 0.05
```

All component values must be normalized to `[0, 1]`.

Weights may be overridden for a replay or agent configuration. Validation must require nonnegative weights and normalize them to sum to one, or reject the configuration if normalization is not part of the public contract.

### 10.7 Deduplication

Deduplicate in this order:

1. Same memory ID from multiple candidate sources
2. Same active canonical key, preferring newest valid and highest-confidence memory
3. Same normalized content hash
4. Optional near-duplicate semantic threshold for unstructured memories

Every suppressed candidate should retain a debugger reason when it was persisted as a candidate.

### 10.8 Selection under budgets

Default limits:

- Maximum selected memories: 12
- Memory context budget: approximately 1,500 tokens

Selection algorithm:

1. Sort candidates by final score descending with stable tie-breaking.
2. Iterate in rank order.
3. Skip candidates that exceed remaining token budget.
4. Stop when memory count or token budget is exhausted.
5. Persist inclusion and exclusion reasons.

Use a deterministic token estimator when provider-specific tokenization is unavailable. Keep the estimator behind an interface so it can later be replaced.

---

## 11. Context block

Do not send raw database rows to the model.

Recommended format:

```text
<MEMORY_CONTEXT>
User: user-123
Generated: 2026-07-13T21:15:00Z

CURRENT PREFERENCES
- [memory:mem_123] Preferred delivery location: Pittsburgh apartment.
  Confidence: 0.96
  Updated: 2026-07-10

ACTIVE TASKS
- [memory:mem_456] User is waiting for order ORD-1042.
  Confidence: 0.91

RELEVANT FACTS
- [memory:mem_789] The user's latest order number is ORD-1042.
  Confidence: 0.88

RECENT CONVERSATION SUMMARY
- User previously asked about changing delivery instructions.

Instructions:
- Treat memories as potentially stale.
- Prefer the newest valid memory when conflicts exist.
- Do not mention memory IDs unless asked.
</MEMORY_CONTEXT>
```

Memory IDs permit attribution in the run trace. The application should not show those IDs in normal assistant output.

---

## 12. Memory extraction

The extraction stage proposes structured mutations. A proposed mutation should include:

```ts
interface MemoryMutationProposal {
  action: "CREATE" | "UPDATE" | "EXPIRE" | "DELETE" | "NONE";
  memoryType:
    | "USER_PREFERENCE"
    | "ENTITY"
    | "FACT"
    | "TASK"
    | "DECISION"
    | "TOOL_RESULT";
  canonicalKey: string | null;
  targetMemoryId: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  importanceScore: number;
  confidenceScore: number;
  expiresAt: string | null;
  evidence: string;
}
```

Store:

- Explicit durable preferences
- Stable user facts
- Decisions
- Unfinished tasks
- Important entities and relationships
- Tool results likely to be reused

Do not store:

- Greetings
- Thanks and acknowledgements
- Temporary wording
- Unverified speculation
- Equivalent information already represented
- Provider or tool secrets
- Sensitive values that violate configured storage policy

The extraction model is not authoritative. Application rules decide whether and how a proposal is applied.

---

## 13. Canonical keys and updates

Canonical keys identify updateable concepts.

Examples:

```text
preference.delivery_location
preference.communication_style
fact.user.timezone
task.order.ORD-1042
decision.project.database
entity.company.acme
```

When the user changes a delivery location:

1. Find active `preference.delivery_location` for the agent and user.
2. Begin a transaction.
3. Verify the expected current version.
4. Insert a revision with prior content and metadata.
5. Update the same memory record.
6. Increment version.
7. Replace the embedding.
8. Commit.

The old preference remains discoverable through revision history but is not a second active memory.

If no canonical key is available, use normalized content and semantic duplicate checks before creating a record.

---

## 14. Contradictions

Examples:

```text
Old: User lives in New Jersey.
New: User lives in Pittsburgh.
```

This is usually a temporal update if the newest statement is explicit.

```text
Memory A: User's legal name is Alex Kim.
Memory B: User's legal name is Jordan Kim.
```

This may require an unresolved contradiction if neither claim supersedes the other with sufficient evidence.

Rules:

- Prefer explicit newer statements for the same canonical key.
- Preserve the prior value as a revision.
- Use validity timestamps when known.
- Create a contradiction only when incompatible claims both remain plausible and current.
- Never silently delete the evidence.
- Allow a developer to resolve the contradiction and record the resolution.

---

## 15. Tool architecture

### 15.1 Tool definition

A tool contains:

- Name
- Description
- HTTP method
- Endpoint template
- Nonsecret header template
- Authentication configuration containing credential references
- JSON request schema
- Optional JSON response schema
- Timeout
- Enabled flag
- Redaction configuration

### 15.2 Execution pipeline

```text
Model tool call
  ↓
Find enabled tool for the current agent
  ↓
Validate arguments against request schema
  ↓
Resolve URL template
  ↓
Validate scheme, host, DNS result, IP ranges, redirects, and method
  ↓
Resolve credentials server-side
  ↓
Build request
  ↓
Execute with timeout and response-size limit
  ↓
Validate optional response schema
  ↓
Redact request and response
  ↓
Persist sanitized ToolExecution
  ↓
Return sanitized result to the model
```

### 15.3 SSRF protection

Production defaults must block:

- Loopback addresses
- RFC1918 private ranges
- Link-local ranges
- Multicast ranges
- IPv6 loopback and local ranges
- Cloud metadata addresses
- Non-HTTP(S) schemes
- Redirects to blocked destinations

A development-only allowlist may permit the repository's mock order service. The allowlist must be explicit and disabled in production.

### 15.4 Secret handling

- Browser forms may submit a new secret but must never receive it back.
- Provider and tool records store credential IDs, not plaintext values.
- Application API keys are hashed.
- Reversible third-party credentials are encrypted using a dedicated service and key version.
- Redaction occurs before persistence and before returning data to clients.
- Error messages are sanitized.

---

## 16. Run tracing and debugger explanations

Recommended run events include:

```text
run.created
message.user.persisted
memory.retrieval.started
memory.embedding.completed
memory.candidates.loaded
memory.ranking.completed
memory.context.built
model.request.started
model.response.received
tool.request.validated
tool.execution.started
tool.execution.completed
message.assistant.persisted
memory.extraction.started
memory.proposals.created
memory.mutations.applied
memory.contradiction.created
run.completed
run.failed
maintenance.enqueued
maintenance.enqueue_failed
```

Selection explanations are deterministic. Example:

```text
Included at rank 2: semantic 0.88, recency 0.94, importance 0.82,
confidence 0.96, preference boost 1.00, final score 0.89.
```

Exclusion examples:

```text
Excluded: duplicate canonical key; newer active memory selected.
Excluded: memory context token budget exhausted.
Excluded: expired at 2026-07-01T00:00:00Z.
```

Do not expose chain-of-thought or ask the model to provide hidden reasoning.

---

## 17. Public API

Required endpoints:

```text
POST   /api/v1/agents
GET    /api/v1/agents
GET    /api/v1/agents/:agentId

POST   /api/v1/agents/:agentId/run
POST   /api/v1/agents/:agentId/memories/search
GET    /api/v1/agents/:agentId/memories

PATCH  /api/v1/memories/:memoryId
DELETE /api/v1/memories/:memoryId
POST   /api/v1/memories/:memoryId/merge

GET    /api/v1/agents/:agentId/contradictions
POST   /api/v1/contradictions/:contradictionId/resolve

POST   /api/v1/tools
GET    /api/v1/agents/:agentId/tools
PATCH  /api/v1/tools/:toolId
DELETE /api/v1/tools/:toolId
POST   /api/v1/tools/:toolId/test

GET    /api/v1/runs
GET    /api/v1/runs/:runId
POST   /api/v1/runs/:runId/replay

GET    /api/v1/evaluations
POST   /api/v1/evaluations
POST   /api/v1/evaluations/run
GET    /api/v1/evaluations/runs/:evaluationRunId
```

### Run request

```json
{
  "userId": "user-123",
  "conversationId": "optional-conversation-id",
  "message": "Find my latest order and tell me when it arrives.",
  "options": {
    "stream": false,
    "memory": {
      "enabled": true,
      "maxMemories": 12,
      "contextTokenBudget": 1500,
      "semanticWeight": 0.5,
      "recencyWeight": 0.2,
      "importanceWeight": 0.15,
      "confidenceWeight": 0.1,
      "typeBoostWeight": 0.05
    }
  }
}
```

### Run response

```json
{
  "runId": "run_123",
  "conversationId": "conv_123",
  "text": "Your latest order is in transit and is expected Tuesday.",
  "memoriesUsed": [
    {
      "id": "mem_123",
      "type": "USER_PREFERENCE",
      "content": "Preferred delivery location is Pittsburgh apartment.",
      "finalScore": 0.89,
      "reason": "Included at rank 1 from semantic relevance and current preference policy."
    }
  ],
  "toolCalls": [
    {
      "name": "get_latest_order",
      "status": "SUCCEEDED",
      "executionTimeMs": 143
    }
  ],
  "usage": {
    "inputTokens": 1134,
    "outputTokens": 126,
    "totalTokens": 1260,
    "estimatedCostUsd": 0.0042
  },
  "latency": {
    "retrievalMs": 39,
    "modelMs": 824,
    "toolMs": 143,
    "postProcessingMs": 121,
    "totalMs": 1182
  }
}
```

### Streaming events

Use typed Server-Sent Events such as:

```text
run.created
memory.retrieval.started
memory.selected
context.built
model.output.delta
tool.started
tool.completed
memory.updated
run.completed
run.failed
```

The stream must end with exactly one terminal event.

---

## 18. Dashboard

Main navigation:

```text
Playground
Memories
Runs
Tools
Evaluations
Settings
```

### Playground

Two-column desktop layout:

```text
┌──────────────────────────────────┬─────────────────────────┐
│ Chat                             │ Debug panel             │
│                                  │                         │
│ User and assistant messages      │ Memories Used           │
│                                  │ Tool Calls              │
│                                  │ Agent Context           │
│                                  │ Trace                   │
│                                  │ Tokens / latency / cost │
└──────────────────────────────────┴─────────────────────────┘
```

The default debug tab is Memories Used.

### Memories

Table columns:

```text
Content | Type | User | Importance | Confidence | Updated | Status
```

Filters:

- Search text
- Agent
- User
- Type
- Importance range
- Date
- Status

Memory detail shows:

- Current content
- Canonical key
- Metadata
- Importance and confidence
- Source
- Revision history
- Runs where selected
- Contradictions
- Edit, delete, expire, and merge actions

### Runs

Run detail shows:

- Input and output
- Effective configuration
- Recent messages
- All memory candidates
- Score breakdown
- Included memories
- Context block
- Model and provider
- Tool requests and responses
- Mutation proposals and applied changes
- Tokens, cost, and latency
- Errors
- Replay action

### Replay

Replay creates a new run and supports overrides for:

- Memory enabled
- Maximum memories
- Ranking weights
- Included memory types
- Context token budget
- Model
- Tools enabled

The UI should compare original and replayed output, memories, tools, tokens, cost, and latency.

---

## 19. Evaluation architecture

An evaluation scenario contains:

- Name and description
- Setup messages
- Trigger message
- Optional run configuration
- Deterministic assertions

Initial assertion types:

```text
memory_exists
memory_count
memory_retrieved
memory_not_stored
tool_called
tool_not_called
response_contains
max_latency
max_token_usage
```

Each evaluation uses an isolated user and conversation so prior manual activity cannot influence the result.

Required MVP scenarios:

1. Remembers a user preference.
2. Updates outdated information.
3. Avoids storing irrelevant details.
4. Retrieves the correct memory after many conversations.
5. Correctly calls a third-party API.
6. Memory reduces repeated questions.

Use deterministic mock providers in the default evaluation and CI suite. Model-based grading may be added later as an optional layer.

---

## 20. Background jobs

### Conversation summarization

Trigger when recent-message or conversation token thresholds are exceeded.

The job should:

1. Load messages not already represented by the current summary watermark.
2. Produce a structured concise summary.
3. Create or update one active `CONVERSATION_SUMMARY` memory.
4. Preserve a revision when updating.
5. Advance the summary watermark transactionally.

The job must be idempotent.

### Expiration

Periodically mark active memories expired when `expiresAt <= now`.

### Cleanup

Delete or archive soft-deleted payloads only according to an explicit retention policy. Historical run references must remain explainable.

### Re-embedding

When the embedding model or dimension changes, use a resumable versioned migration job. The MVP avoids mixed dimensions in one vector column.

### Evaluation batches

Run evaluation cases asynchronously when executing a suite. Individual interactive evaluation runs may execute synchronously if their latency is acceptable.

---

## 21. Reliability and concurrency

### Per-conversation lock

Serialize turns for the same agent and user to prevent:

- Out-of-order assistant messages
- Lost canonical-key updates
- Duplicate memory creation
- A follow-up missing the immediately previous preference

The lock must have:

- A bounded lease
- Safe release using ownership tokens
- Renewal for long-running model/tool operations if necessary
- Clear timeout behavior

Database optimistic concurrency remains necessary for memory updates because locks can expire or operations may be retried.

### Idempotency

Use idempotency keys for externally retried run and tool-test requests when added to the public contract. At minimum, repository writes must avoid duplicate run terminalization and duplicate revision insertion on retried internal operations.

### Failure behavior

- Provider failure: fail the run with sanitized error.
- Tool failure: persist the failure and let the model respond if policy allows; otherwise fail with a normalized tool error.
- Memory extraction failure: configurable. Initial recommendation is to complete the user-visible response but mark post-processing degraded and create a trace event. However, preference consistency tests should use providers and paths where extraction succeeds.
- Maintenance enqueue failure: do not fail an already completed run.

The exact degraded-memory behavior must remain consistent in code, contracts, and UI.

---

## 22. Cost and token accounting

Store provider-reported usage when available.

Estimated cost must be calculated from versioned configurable pricing:

```text
estimatedCost =
  inputTokens  / 1,000,000 * inputPricePerMillion +
  outputTokens / 1,000,000 * outputPricePerMillion
```

Do not hardcode prices in orchestration logic. Record the pricing configuration or version used for each estimate so historical runs remain understandable when prices change.

Tool and embedding costs may be added as separate cost components.

---

## 23. Database and vector indexing

Enable pgvector through a migration.

The initial memory embedding column uses one fixed dimension selected by configuration and migration.

Recommended indexes:

```sql
CREATE INDEX memory_embedding_hnsw_idx
ON "Memory"
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX memory_active_lookup_idx
ON "Memory" ("agentId", "agentUserId", "memoryType")
WHERE status = 'ACTIVE';

CREATE UNIQUE INDEX memory_active_canonical_key_idx
ON "Memory" ("agentId", "agentUserId", "canonicalKey")
WHERE status = 'ACTIVE' AND "canonicalKey" IS NOT NULL;
```

Exact index names may follow migration conventions, but the semantics must remain.

Use explicit selected columns in raw vector queries rather than selecting the unsupported vector field into Prisma-generated models.

---

## 24. Demo agent and mock order API

Mock endpoints:

```text
GET   /api/demo/orders/latest?userId=user-123
GET   /api/demo/orders/:orderId
PATCH /api/demo/orders/:orderId/delivery-location
```

Example response:

```json
{
  "orderId": "ORD-1042",
  "userId": "user-123",
  "status": "IN_TRANSIT",
  "estimatedDelivery": "2026-07-15",
  "deliveryLocation": "Pittsburgh apartment"
}
```

Seeded tool:

```json
{
  "name": "get_latest_order",
  "description": "Gets the user's most recent order and delivery status.",
  "method": "GET",
  "endpoint": "http://localhost:3000/api/demo/orders/latest",
  "requestSchema": {
    "type": "object",
    "properties": {
      "userId": { "type": "string" }
    },
    "required": ["userId"],
    "additionalProperties": false
  }
}
```

Demo sequence:

1. User: “Please deliver future orders to my Pittsburgh apartment.”
2. System stores one active `preference.delivery_location` memory.
3. User: “Where is my latest order?”
4. System retrieves the preference.
5. Agent calls `get_latest_order`.
6. Run view shows the preference, score, context, request, response, latency, tokens, and cost.
7. User: “Use my New Jersey address instead.”
8. The original memory is updated.
9. Revision history retains Pittsburgh.
10. Only one active delivery-location preference remains.

---

## 25. Testing strategy

### Unit tests

- Score calculations
- Recency decay
- Weight validation
- Deduplication
- Context selection
- Extraction-policy decisions
- Redaction
- Cost calculations
- Error normalization

### Database integration tests

- Vector search
- Agent/user isolation
- Expiration filtering
- Canonical-key uniqueness
- Revision transaction
- Optimistic concurrency
- Soft deletion
- Run-memory persistence

### Service integration tests

Use mock providers and a mock tool server to test:

- Complete run orchestration
- Tool loop
- Immediate memory consistency
- Run failure behavior
- Replay
- Evaluations

### End-to-end tests

Use Playwright for:

- Agent setup
- Preference storage and retrieval
- Tool-call inspection
- Memory edit/delete/merge
- Revision display
- Replay comparison
- Evaluation result display

No default test should require a paid live provider.

---

## 26. Deployment shape

Initial production deployment:

- One Next.js web service
- One worker service from the same repository
- Managed PostgreSQL with pgvector
- Managed Redis
- External key-management or deployment secret for credential encryption

Both services use the same application version and database schema.

Health checks:

- Web process health
- Database connectivity
- Redis connectivity
- Worker heartbeat

Do not expose detailed dependency errors publicly.

---

## 27. Architectural decisions

### ADR-001: Modular monolith

Chosen to preserve iteration speed and transactional consistency.

### ADR-002: PostgreSQL plus pgvector

Chosen so relational state, memory metadata, vector search, and run traces share one transactional database.

### ADR-003: Prisma plus database-owned vector SQL

Prisma handles standard relational access. The database package owns parameterized raw SQL for vector operations.

### ADR-004: Durable run traces

Run observability is stored as structured first-class data because debugger behavior cannot depend on best-effort logs.

### ADR-005: Canonical-key updates with revisions

Structured concepts update one active memory while preserving prior values as revisions.

### ADR-006: Synchronous immediate consolidation

New memory required by the next turn is consolidated before the conversation lock is released.

### ADR-007: Deterministic explanations

Memory explanations derive from scores and rules, not hidden model reasoning.

### ADR-008: Server-side secret references

Agents and tools reference encrypted credentials; plaintext values are never returned to clients.

### ADR-009: Safe generic HTTP tools

The MVP supports schema-validated HTTP tools, not arbitrary code execution.

### ADR-010: Deterministic evaluations first

The first evaluation engine uses explicit assertions and mock providers. Model graders are optional future functionality.
