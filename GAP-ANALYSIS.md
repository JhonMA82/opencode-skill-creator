# Gap Analysis — opencode-skill-creator fork evolution

> Mandated by `opencode-skill-creator-propuesta-evolucion.md` §28 before any implementation.
> Base commit: `92f1985` (upstream `main`, v0.2.25 source). Fork: `JhonMA82/opencode-skill-creator`.

## 1. Existing upstream capabilities

| Capability | Exists | Location | Notes |
|---|---:|---|---|
| Skill creation pipeline (intake → draft → test → eval → optimize → install) | yes | `plugin/skill/SKILL.md`, `opencode-skill-creator/SKILL.md` | Keep, extend |
| Baseline eval (`without_skill` / `old_skill` pairing) | yes | SKILL.md:184–213; `plugin/lib/workflow-guard.ts:42–147`; `plugin/lib/aggregate.ts:327–345` | Agent-driven benchmark workspace; enforced at review launch, not automated in trigger eval |
| Trigger eval (`skill_eval`, binary `should_trigger`) | yes | `plugin/lib/run-eval.ts:35–497` | No baseline comparison, no third `ambiguous` state |
| Description/trigger optimizer | yes | `plugin/lib/improve-description.ts`, `plugin/lib/run-loop.ts` | Keep as-is (Anton-owned) |
| Benchmark aggregation + delta | yes | `plugin/lib/aggregate.ts` | Delta between first two configs |
| Human review viewer | yes | `plugin/lib/review-server.ts`, `plugin/templates/viewer.html` | Keep |
| Skill validation (frontmatter/structure) | yes | `plugin/lib/validate.ts` | Lint-only; no token/context checks |
| Gold standards | yes | `plugin/lib/gold-standards.ts` | Keep |
| Failure taxonomy | yes | `plugin/lib/failure-taxonomy.ts` | Trigger-eval failures only |
| **Skill type classification** (discipline/technique/pattern/reference/workflow) | **no** | — | gap |
| **`failure_case` / `expected_behavior` in eval cases** | **partial** | `plugin/skill/references/schemas.md:11–35` (`evals.json`) | Documentation-only; no code reads/writes it |
| **Pressure/adversarial eval cases** | **no** | — | gap |
| **Rationalization capture** (observable failure explanation) | **no** | — | gap |
| **Regression case promotion** (failure → permanent suite) | **no** | — | gap |
| **Token/context budget lint** (words, tokens, reference depth, duplicates) | **no** | — | gap |
| **Instruction usefulness analysis** (with/without, recommendation) | **partial** | `aggregate.ts:320–345` (delta only) | No recommendation output |
| **`ambiguous` trigger state** | **no** | — | gap (deferred, see §3) |
| **Comet adapter** | **no** | — | gap (deferred, see §3) |

## 2. Proposed changes actually required

1. **V1 — Behavioral TDD** (`feat/behavioral-tdd`):
   - `plugin/lib/behavioral-tdd.ts`: skill-type taxonomy, per-type baseline policy, behavioral case validation (type/intent/expected_behavior/baseline), rationalization record schema + collection from `grading.json`, regression-suite store (load/save/promote, dedupe by prompt).
   - New plugin tools: `skill_validate_cases`, `skill_collect_rationalizations`, `skill_regression_suite`.
   - `plugin/skill/SKILL.md` + `opencode-skill-creator/SKILL.md`: skill-type classification at intake, RED→GREEN→REFACTOR loop, baseline policy per type, pressure-case guidance, rationalization capture (observable summaries only, never chain-of-thought), regression promotion.
   - `plugin/skill/references/schemas.md` + `opencode-skill-creator/references/schemas.md`: behavioral case, rationalization, regression-suite schemas.
   - Tests: `plugin/test/behavioral-tdd.test.ts` (bun).
2. **V1.1 — Context budget lint** (`feat/context-budget`):
   - `plugin/lib/context-budget.ts`: SKILL.md word/token estimate, reference count/depth, largest reference, duplicate sections, examples count.
   - New tool `skill_context_lint` with configurable budgets (defaults: SKILL.md warning 500 words; reference depth warning 2).
   - Tests: `plugin/test/context-budget.test.ts`.
3. **V1.2 — Instruction usefulness analysis** (`feat/instruction-usefulness`):
   - `plugin/lib/instruction-usefulness.ts`: delta computation with sample-size-aware recommendation (keep / review / remove / insufficient-data).
   - New tool `skill_instruction_usefulness`.
   - Tests: `plugin/test/instruction-usefulness.test.ts`.
4. **Docs** (`docs/`): `GAP-ANALYSIS.md`, `methodologies/behavioral-tdd.md`, `methodologies/evaluation-strategy.md`, `methodologies/progressive-disclosure.md`, `methodologies/instruction-quality.md`; README fork section with provenance matrix (§32).

## 3. Changes rejected / deferred as redundant

1. **New Agent Skills format** — rejected (principle 10; §26 non-goal).
2. **Replace Anton's trigger optimizer / review viewer / install flow** — rejected (upstream-owned, §19; works correctly).
3. **`previous_version` config string in trigger eval** — rejected: the benchmark workspace already models previous versions via `old_skill` from `skill-snapshot/` (SKILL.md:199–201).
4. **14 pipeline phases as 14 separate commands** — rejected (§12: reuse the existing workflow; add only missing capabilities).
5. **`ambiguous` trigger state in `skill_eval`** — deferred: would change Anton-owned trigger semantics and pass thresholds; near-miss `should_not_trigger` cases already cover the intent (§11 "extend only if necessary").
6. **Comet adapter (V1.3)** — deferred: no demonstrated composition/export need in this fork yet (§16: "Únicamente si aparece una necesidad real"); architecture decision documented in `docs/methodologies/` and README.
7. **Full cross-agent packaging (Francy) / second methodology copy (Gentleman)** — rejected per §18.
8. **Token budgets as hard errors** — rejected: warnings only, configurable (§10).

## 4. V1 closure

### Completed

- **fork distribution clarified** — README now has a "Fork identity and installation" section: the npm package `opencode-skill-creator` is explicitly attributed to upstream (so `npx` installs upstream, never this fork), fork installation from GitHub is documented, and the fork's auto-update check behavior (`OPENCODE_SKILL_CREATOR_AUTO_UPDATE=0`) is explained. Manual-install clone URL now points at the fork. `plugin/package.json` metadata deliberately stays upstream-owned (the fork does not publish the npm identity; keeping the file byte-identical to upstream avoids conflict surface on every upstream version bump — documented decision).
- **instruction usefulness hardened** — `plugin/lib/instruction-usefulness.ts` now derives integer evidence (`passed` counts) instead of trusting arbitrary percentages, rejects impossible rate/run combinations (e.g. `0.55` with 5 runs), adds the canonical `assessInstructionUsefulnessFromEvidence` API, and gates `keep` on non-overlapping Wilson 95% intervals so small samples can no longer justify strong verdicts. 18 tests, including weak/strong/regression/invalid-data scenarios.
- **CI added** — `.github/workflows/ci.yml` runs the TypeScript suite, the build, the package tests, and a `dist` consistency check on every push and pull request (previously no workflow executed tests for the fork).
- **upstream conflict surface reduced** — the five fork tool registrations moved out of `plugin/skill-creator.ts` into `plugin/lib/evidence-tools.ts`; the fork delta in the upstream-owned entrypoint shrank from +230 to +7 lines (one import + one spread).
- **regression suite validation hardened** — `loadRegressionSuite` validates every case against the actual schema and throws aggregated errors on malformed suites; `promoteToRegression` rejects cross-skill appends; the atomic tmp-file + rename write is preserved.
- **optional strict behavioral validation** — `validateBehavioralCases(data, { strict })` promotes missing `expected_behavior` (pressure/regression) and missing `baseline.required` (discipline/workflow) from warnings to errors; `skill_validate_cases` exposes the optional `strict` argument.
- **advisory description-trigger lint** — `skill_context_lint` gained the advisory `description_trigger` check (short descriptions warn that the skill may not say WHEN to trigger; purely advisory, no content gate).

### Deferred

- automatic pressure runner
- Comet adapter
- ambiguous trigger state
- multi-platform packaging
