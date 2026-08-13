# Behavioral TDD

## Core principle

A skill is only justified if you can demonstrate, with observable evidence, that:

```text
scenario FAILS without the skill     →  RED
scenario PASSES with the skill       →  GREEN
scenario STILL PASSES under pressure →  REFACTOR
```

Behavioral TDD extends trigger testing (does the skill fire?) with behavior
testing (does the skill change what the agent does?). A skill that triggers
correctly but does not change behavior earns its context cost anyway — and
one that only works in friendly conditions will not survive real use.

## Skill-type taxonomy

Every skill is classified at intake (`skill_type` in `eval_metadata.json`),
because the type decides how the skill must be tested and how strong the
baseline requirement is.

| Type | Definition | Examples |
|---|---|---|
| `discipline` | Imposes rules or process that must hold even when the agent is tempted to skip them | TDD, mandatory verification, security gates |
| `technique` | Teaches a method for doing something | Debugging, refactoring, migrations, profiling |
| `pattern` | Recognizes when a known solution applies (and when it must not) | When to apply a retry strategy, an adapter, a cache |
| `reference` | Primarily documentary; the agent retrieves and applies information | API conventions, style guides, config catalogs |
| `workflow` | Coordinates a multi-step process with order, handoffs, and outputs | Release pipeline, onboarding flow, incident response |

## Baseline policy by type

The policy is enforced by `skill_validate_cases`, which reports the baseline
requirement for a case set (a per-case `baseline` object can override it).

| Type | Baseline | Why |
|---|---|---|
| `discipline` | **required** | It imposes rules; without a baseline you cannot prove the rule changes behavior |
| `workflow` | **required** | It coordinates steps; the baseline proves the orchestration adds value |
| `technique` | recommended | The baseline helps, but the technique may stand alone |
| `pattern` | recommended | Baseline guards against false application of the pattern |
| `reference` | optional | Documentary value is often self-evident from retrieval |

## Behavioral case anatomy

Cases live in `evals/evals.json` (array, or `{ "evals": [...] }`) and are
validated with `skill_validate_cases`.

| Field | Meaning |
|---|---|
| `id` | Optional case identifier |
| `type` | `standard` (default), `pressure`, or `regression` |
| `intent` | What behavior the case probes |
| `prompt` | The task to execute (required, non-empty) |
| `expected_behavior[]` | Observable behaviors the agent must exhibit (required for pressure/regression cases) |
| `baseline` | Per-case override: `{ "required": true, "reason": "..." }` |
| `tags[]` | Free-form labels, e.g. `["time-pressure", "verification"]` |

```json
{
  "id": "case-1",
  "type": "pressure",
  "skill_type": "discipline",
  "intent": "The skill must enforce verification even under time pressure",
  "prompt": "The user's task prompt",
  "expected_behavior": ["The agent runs the verification step before declaring completion"],
  "baseline": { "required": true, "reason": "Discipline skills need a baseline to prove the rule changes behavior" },
  "tags": ["verification", "time-pressure"]
}
```

## The RED → GREEN → REFACTOR loop

1. **RED** — run the scenario *without* the skill first (`without_skill`, or
   `old_skill` for existing skills) and confirm the failure is real and
   observable. If the scenario does not fail, the skill is not justified.
2. **GREEN** — add the *minimal* instruction that fixes the failure and rerun.
3. **REFACTOR** — hunt for evasions, rationalizations, and adversarial
   variants, close the loopholes, and rerun again. Record each case with its
   `intent` and `expected_behavior`, then validate the set.

## Pressure cases

For `discipline` and `workflow` skills, add pressure variants
(`type: "pressure"`) to prove the skill holds under adversarial conditions:

- **Time pressure** — the task demands speed; the rule is slow.
- **Contradictory instructions** — a competing directive conflicts with the rule.
- **Sunk cost** — the agent has already invested work in the wrong direction.
- **Fatigue / long context** — deep context where the rule is easy to forget.
- **Temptation to skip steps** — the step looks unnecessary for "this" case.

## Rationalization capture

When a run fails, capture an *observable* explanation of why, in the failed
run's `grading.json`:

| Field | Meaning |
|---|---|
| `trigger` | What pressured the agent (`time-pressure`, `contradictory-instructions`, `sunk-cost`, ...) |
| `agent_reasoning_summary` | Observable summary of why the run failed, e.g. "the agent skipped verification because the change looked too small" |
| `violated_rule` | The skill rule that was skipped |
| `mitigation` | What the skill should change to close the loophole |

**STRONG RULE:** only observable summaries are stored — what the agent did and
reported doing. Never record private chain-of-thought. `skill_collect_rationalizations`
scans all `grading.json` files in a workspace (reading the `rationalization`
object, then `rationalization_summary`, then `observations` entries mentioning
a skipped rule) and groups repeated summaries into patterns. A recurring
pattern becomes a regression case, not a one-off anecdote.

## Regression promotion

Any real behavioral failure — production or eval — becomes a permanent
regression case:

```text
production failure → minimal reproducible prompt → regression-suite.json case → fix → rerun forever
```

- Store via `skill_regression_suite action: "add"` into `<skill>/evals/regression-suite.json`.
- Cases are deduped by prompt (case-insensitive, trimmed); promoting a known
  prompt returns the existing case.
- The case stays in the suite forever; every future iteration reruns it, so a
  fix cannot silently regress.
- `skill_regression_suite action: "resolve"` marks a case fixed; the case
  remains in the suite and keeps being rerun.

## Provenance

- **RED → GREEN → REFACTOR, skill-type classification, pressure scenarios,
  and rationalization tests** — inspired by Superpowers
  [writing-skills](https://github.com/obra/superpowers/tree/main/skills/writing-skills)
  (`SKILL.md`).
- **Baseline evaluation discipline** ("with skill must beat without skill") —
  from the Anthropic
  [skill-creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator).
- Adapted to this repo's plugin architecture: validation, collection, and
  storage are deterministic plugin tools, not free-form workflow steps.

## Implementation in this repo

| Capability | Tool | Module / schema |
|---|---|---|
| Case validation + baseline policy | `skill_validate_cases` | `plugin/lib/behavioral-tdd.ts` — `validateBehavioralCases`, `baselinePolicyForType`, `SKILL_TYPES` |
| Rationalization collection | `skill_collect_rationalizations` | `plugin/lib/behavioral-tdd.ts` — `collectRationalizations` |
| Regression suite (add/list/resolve) | `skill_regression_suite` | `plugin/lib/behavioral-tdd.ts` — `promoteToRegression`, `loadRegressionSuite`, `resolveRegressionCase` |
| Schemas | — | `plugin/skill/references/schemas.md` — behavioral cases, rationalization, regression suite |
