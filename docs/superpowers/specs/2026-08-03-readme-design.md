# Portfolio README Design

## Objective

Create a polished repository front page for potential employers and senior engineering reviewers. The README should make the project memorable by showing strong product judgment, system-design skill, security awareness, and disciplined implementation without implying that roadmap capabilities are already complete.

## Audience and positioning

The primary audience is a technical hiring manager evaluating the repository quickly. The page should answer four questions within the first screenful:

1. What problem does this solve?
2. Why is the problem technically interesting?
3. What distinguishes this implementation?
4. What can a reviewer inspect today?

The positioning is an engineering-first product showcase: a developer tool for making AI-agent memory observable, replayable, deterministic where possible, and safe to operate.

## Narrative structure

The README will use this sequence:

1. **Hero** — project name, concise value proposition, restrained technology/status badges, and links to architecture and project plan.
2. **Problem and thesis** — explain that agent memory is difficult to trust when retrieval, exclusion, mutation, contradiction handling, and tool behavior are opaque.
3. **Core capabilities** — summarize observable memory decisions, deterministic ranking, durable traces, replay, evaluations, safe HTTP tools, dashboard access, and the TypeScript SDK.
4. **Current implementation status** — explicitly separate foundations implemented today from capabilities on the MVP roadmap.
5. **Architecture** — show the modular monolith, worker, PostgreSQL/pgvector, Redis, package boundaries, and external model/tool adapters in a Mermaid diagram.
6. **Run lifecycle** — show the intended retrieval-to-response trace as a compact Mermaid flow.
7. **Concrete scenario** — demonstrate a delivery-location preference being created, retrieved, updated in place, and preserved through revision history.
8. **Engineering highlights** — cover deterministic ranking, structured observability, transaction boundaries, provider isolation, strict TypeScript, testing, and security controls.
9. **Quick start** — prerequisites, environment setup, Docker services, migration, seed, development server, and verification commands.
10. **Repository map and roadmap** — explain package ownership and link readers to PLAN.md for granular progress.
11. **Portfolio close** — concisely state what the project demonstrates about the author's engineering approach.

## Visual treatment

Use clean GitHub-flavored Markdown with a centered hero, a small number of badges, concise tables, fenced examples, blockquote callouts, and Mermaid diagrams. Avoid decorative clutter, excessive emoji, fake screenshots, or claims such as "production-ready." Visual hierarchy should come from short sections and concrete diagrams rather than oversized prose.

## Accuracy rules

- Describe the complete system as the product mission or target MVP.
- Label implemented foundations explicitly: pnpm monorepo, Next.js/worker packages, environment validation, health checks, Prisma schema, pgvector migration, deterministic seed data, and existing unit/integration coverage.
- Label the agent debugger dashboard, full orchestration, replay, evaluation engine, safe tool execution, and public SDK as roadmap work unless the repository proves otherwise.
- Do not invent performance numbers, adoption claims, screenshots, CI status, licenses, deployment URLs, or package publication details.
- Link to docs/architecture.md and PLAN.md rather than duplicating their full contents.

## Verification

After implementation:

- Check every command, path, technology, and status claim against the repository.
- Scan for placeholders and unsupported claims.
- Verify Markdown structure, local links, fenced blocks, tables, and Mermaid syntax by inspection.
- Run the repository formatter check against the README if supported; otherwise run Prettier directly in check mode.
- Review git diff -- README.md to confirm the change is documentation-only and matches this design.
