# AGENTS.md — plugin/

## Purpose

The OpenCode plugin half of the project (npm package `opencode-skill-creator`): TypeScript source that registers custom tools for the skill development lifecycle — validation, parsing, context-budget lint, trigger eval, description optimization, benchmarking, and review serving.

## Ownership

- `skill-creator.ts` — plugin entry point; every tool registration lives here as one `tool({...})` block
- `lib/` — pure logic modules (`aggregate.ts`, `context-budget.ts`, `failure-taxonomy.ts`, `gold-standards.ts`, `improve-description.ts`, `process.ts`, `report.ts`, `review-server.ts`, `run-eval.ts`, `run-loop.ts`, `skill-install.ts`, `utils.ts`, `validate.ts`, `workflow-guard.ts`)
- `lib/` — pure logic modules (`aggregate.ts`, `context-budget.ts`, `failure-taxonomy.ts`, `gold-standards.ts`, `improve-description.ts`, `instruction-usefulness.ts`, `process.ts`, `report.ts`, `review-server.ts`, `run-eval.ts`, `run-loop.ts`, `skill-install.ts`, `utils.ts`, `validate.ts`, `workflow-guard.ts`)
- `test/` — bun tests (`*.test.ts`) and node/package tests (`*.test.mjs`)
- `dist/` — committed compiled output; `npm run build` regenerates it from sources
- `skill/` — bundled skill mirror of the repo-root `opencode-skill-creator/`; keep both copies identical on every edit
- `bin/`, `scripts/`, `templates/` — CLI entry, build tooling, viewer HTML template

## Local Contracts

- Code style: TypeScript, no semicolons, single quotes, 2-space indent
- `lib/` must not use Bun-specific APIs — `dist/` also runs under Node (`package.test.mjs` enforces no `Bun` references)
- `dist/` is committed and must be regenerated (`npm run build`) whenever sources change; `package.test.mjs` verifies `build-manifest.json` matches sources
- Do not edit `package-lock.json` manually

## Work Guidance

- New tools: register in `skill-creator.ts`, add to `## Available plugin tools` in both SKILL.md copies, document in `references/schemas.md` (both copies) and the README plugin-tools tables
- Doc mirrors: any edit to `skill/SKILL.md` or `skill/references/schemas.md` must be applied identically to `opencode-skill-creator/SKILL.md` / `opencode-skill-creator/references/schemas.md`
- New tests: `test/*.test.ts` with bun:test for TS modules; `test/*.test.mjs` with node --test for package/CLI behavior

## Verification

- `bun test --isolate test/*.test.ts` — TS suite
- `npm test` — mjs suite (requires fresh `dist/`)
- `npm run build` — regenerate `dist/`

## Child DOX Index

- none
