# Portfolio README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a polished, accurate, employer-focused README that presents the product vision, implemented foundation, architecture, engineering rigor, and local setup.

**Architecture:** This is a documentation-only change. A single root README will act as the project front page, link to the detailed architecture and milestone ledger, and clearly distinguish implemented foundations from target-MVP capabilities.

**Tech Stack:** GitHub-flavored Markdown, Mermaid, TypeScript, Next.js, PostgreSQL, pgvector, Redis, Prisma, pnpm

## Global Constraints

- Optimize the narrative for technical hiring managers and senior engineers.
- Keep roadmap capabilities visibly separate from implemented functionality.
- Do not invent performance figures, users, deployment URLs, screenshots, licenses, or CI results.
- Use restrained badges, two Mermaid diagrams, concise tables, and concrete examples.
- Link to docs/architecture.md and PLAN.md instead of duplicating them.
- Change only README.md during implementation.

---

### Task 1: Create and verify the portfolio README

**Files:**
- Create: README.md
- Reference: docs/superpowers/specs/2026-08-03-readme-design.md
- Reference: PLAN.md
- Reference: docs/architecture.md
- Reference: package.json
- Reference: .env.example
- Reference: docker-compose.yml

**Interfaces:**
- Consumes: repository scripts, environment names, service definitions, package boundaries, architecture decisions, and current milestone state.
- Produces: a root GitHub landing page for potential employers.

- [ ] **Step 1: Confirm the baseline**

Run: `Test-Path README.md`

Expected: `False`

- [ ] **Step 2: Create the hero and problem statement**

Create README.md with a centered hero titled “Memory Orchestration Debugger,” the tagline “Make AI-agent memory observable, explainable, and testable,” restrained TypeScript, Next.js, PostgreSQL/pgvector, Prisma, and pnpm badges, plus links to the architecture, plan, and quick start.

Follow it with “Why this project exists.” Explain that conventional logs cannot reliably answer which memories were considered, ranked, selected, excluded, updated, contradicted, or expired. End with this callout:

```markdown
> The goal is not merely to give an agent memory. The goal is to make memory behavior debuggable.
```

- [ ] **Step 3: Document the product vision and honest current state**

Add a “Target MVP” table covering memory retrieval, deterministic ranking, context selection, memory evolution, safe tools, replay/evaluations, and developer access.

Add “Current implementation status” with two visibly separate groups.

Implemented foundation:
- pnpm modular-monolith workspace
- strict TypeScript and package boundaries
- Next.js application shell and health endpoint
- PostgreSQL/Prisma schema and pgvector migration
- memory repository primitives
- dependency-injected run orchestration service contracts and lifecycle
- deterministic demo seed
- Vitest, integration, Playwright, lint, type-check, build, and CI foundations

In active development:
- public APIs and provider adapters
- end-to-end wiring
- extraction and consolidation
- safe HTTP tools
- debugger dashboard
- replay, evaluations, and public SDK

Link granular status to PLAN.md.

- [ ] **Step 4: Add architecture and lifecycle visuals**

Add a Mermaid architecture diagram showing Developer → Dashboard/SDK → API → Core, with Core connected to database repositories, PostgreSQL/pgvector, Redis, providers, tools, and the worker.

Add a package-boundary table for apps/web, apps/worker, and packages/core, db, contracts, sdk, and ui.

Add a second Mermaid diagram for the observable run lifecycle:

```text
request → conversation lock → recent messages → retrieve candidates
→ deterministic ranking → budget selection → exact context
→ model/tool loop → persist response → extract mutations
→ transactional consolidation → finalize trace → release lock
```

- [ ] **Step 5: Explain the differentiating engineering decisions**

Add these sections:

1. “Deterministic memory ranking” with the exact default weights: semantic 0.50, recency 0.20, importance 0.15, confidence 0.10, type boost 0.05.
2. Observable inclusion and exclusion examples derived from score components and explicit rules.
3. “Memory that evolves without losing history” explaining canonical keys, revisions, version checks, embedding refresh, and one-active-memory semantics.
4. The three-turn Pittsburgh/New Jersey delivery-location demo from docs/architecture.md.
5. “Security is an architectural constraint” covering hashed API keys, encrypted credential references, redaction, SSRF defense, error sanitization, database SQL boundaries, and no paid live calls in default tests.
6. “Engineering principles demonstrated” covering observability, determinism, history preservation, package boundaries, secure defaults, and milestone-based delivery.

All complete-system behavior must be framed as designed, intended, target-MVP, or roadmap behavior unless it appears in the implemented-foundation list.

- [ ] **Step 6: Add verified setup and navigation**

Add a Quick Start with:

```bash
git clone https://github.com/ri-shenvi/agent-memory-orchestration.git
cd agent-memory-orchestration
pnpm install
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

State that the web app uses http://localhost:3000 and health uses http://localhost:3000/api/health. Show the PowerShell environment-copy command `Copy-Item .env.example .env`.

Add verification commands, a command-purpose table using the exact scripts in package.json, the repository layout, a roadmap summary, and a centered portfolio-oriented closing sentence.

- [ ] **Step 7: Verify formatting and unsupported claims**

Run:

```powershell
pnpm exec prettier --check README.md
rg -n "TBD|TODO|PLACEHOLDER|production-ready|fully implemented" README.md
```

Expected: Prettier reports README.md as correctly formatted. The claim scan returns no matches.

- [ ] **Step 8: Verify links and documentation-only scope**

Run:

```powershell
Test-Path PLAN.md
Test-Path docs/architecture.md
git diff --check
git status --short
git diff -- README.md
```

Expected: both link targets return True; git diff --check exits successfully; implementation adds only README.md.

- [ ] **Step 9: Commit the README**

```bash
git add README.md
git commit -m "docs: add portfolio project README"
```

