# Evaluation Strategy

## Core principle

The skill type selects the evaluation strategy. One evaluation does not fit
all skills: a discipline skill is best tested by pressure, a reference skill
by retrieval, a workflow skill by orchestration order. Classifying the skill
type first (see [behavioral-tdd.md](behavioral-tdd.md)) is what makes the
right strategy obvious.

## Per-type strategy

| Type | What to test | Typical checks |
|---|---|---|
| `discipline` | Obedience when the rule is costly or contested | Time pressure, contradictory instructions, authority pushing against the rule, sunk cost, long/fatigued context, temptation to skip steps |
| `technique` | Correct application of the method | Correct application, edge cases, incomplete information, variants of the problem |
| `pattern` | Recognition, in both directions | When the pattern applies **and** when it must NOT apply — false positives and false negatives |
| `reference` | Retrieval and application of information | Retrieval of the right reference, coverage of the catalog, correct reference selection, correct application of the information |
| `workflow` | Orchestration of the whole process | Step order, preconditions, handoffs between steps, outputs, error recovery, completion |

Pressure/adversarial evaluation (discipline) is described in
[behavioral-tdd.md](behavioral-tdd.md); pattern skills are the one type where
negative cases are as important as positive ones — a pattern that fires
incorrectly is worse than one that never fires.

## Trigger evals vs behavioral evals

The two eval families prove different claims — do not substitute one for the
other:

| | Trigger evals (`skill_eval`) | Behavioral evals (workspace runs) |
|---|---|---|
| Question | Does the description route queries correctly? | Does the skill change agent behavior? |
| Signal | Binary `should_trigger` / `should_not_trigger` per query | Graded pass/fail against observable assertions per case |
| Baseline | None (accuracy of routing, not of behavior) | Paired `with_skill` vs baseline (`without_skill` or `old_skill`) |
| Optimizes | `description` frontmatter | SKILL.md instructions and structure |

## Baseline discipline

Every behavioral eval runs paired configurations, launched in the same turn:

- **New skill** — baseline is `without_skill`: the same prompt with no skill.
- **Existing skill** — snapshot the current skill before editing
  (`cp -r <skill-path> <workspace>/skill-snapshot/`), then run the baseline
  against the snapshot as `old_skill`. This models "previous version" without
  a separate config field.

Baseline pairing is enforced by the existing workflow guard: the review
launch tools (`skill_serve_review`, `skill_export_static_review`) fail fast
unless every `eval-*` directory has `with_skill` plus one baseline
(`without_skill` or `old_skill`). Pass `allowPartial: true` only when
deliberately reviewing incomplete data.

Baseline discipline also answers the RED question: a scenario that passes
without the skill is not a case for the skill.

## Instruction usefulness for technique and reference skills

For `technique` and `reference` skills, where outputs are gradable and
individual instructions can be isolated, run the instruction-usefulness
analysis: compare pass rates of the same eval set with and without one
instruction, with at least 5 runs per side. This decides whether a specific
instruction earns its context cost — see
[instruction-quality.md](instruction-quality.md).

## Provenance

- **Skill-type classification and per-type evaluation strategies** — inspired
  by Superpowers
  [writing-skills](https://github.com/obra/superpowers/tree/main/skills/writing-skills)
  (`SKILL.md`), which classifies skills to choose test strategies.
- **Baseline pairing, trigger eval, and benchmark aggregation** — aligns with
  this repo's existing (upstream) workflow: paired `without_skill`/`old_skill`
  runs, `skill_aggregate_benchmark` deltas, and the review viewer.

## Implementation in this repo

| Capability | Where |
|---|---|
| Skill-type taxonomy and per-type baseline policy | `plugin/lib/behavioral-tdd.ts` — `SKILL_TYPES`, `baselinePolicyForType`; surfaced by `skill_validate_cases` |
| Baseline pairing enforcement | Existing workflow guard in `plugin/lib/review-server.ts` (strict by default, `allowPartial` override) |
| Trigger evals | `skill_eval` (upstream, conserved) |
| Benchmark aggregation with deltas | `skill_aggregate_benchmark` (upstream, conserved) |
| Instruction usefulness | `skill_instruction_usefulness` — `plugin/lib/instruction-usefulness.ts` |
